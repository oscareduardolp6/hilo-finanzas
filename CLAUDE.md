# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Hilo" is a personal finance tracker (Mexican Spanish UI, MXN currency), built as a **single React component** ([hilo-finanzas.jsx](hilo-finanzas.jsx)) that exports a default `App` and is styled with Tailwind utility classes and inline style objects. There's no linter or test suite, and no other source files besides the local-dev scaffold described below — all product logic lives in that one `.jsx` file. npm deps are `react`/`react-dom`, `recharts` (charts), `lucide-react` (icons), and `qrcode` + `jsqr` (device-sync QR encode/decode).

### Product direction: local-only SPA, no backend

The intent, at least for now, is for Hilo to stay a **client-only single-page app with no backend**. There is no server and no API — everything a user enters is stored **locally in their own browser**, via IndexedDB (native `indexedDB` API, no wrapper library — see `openDb`/`loadState`/`saveState` in [hilo-finanzas.jsx](hilo-finanzas.jsx)). This is what makes the app work as a real local tool in a normal browser (dev build or eventually a deployed static build), independent of any host. Cross-device sync is **manual and backend-free**: `SyncModal` exports the state blob as a file / compressed-text string / QR and merges an incoming one by `id`; `BackupModal` exports the same blob and restores it by full replace. See [tasks/desktop-mobile-sync.md](tasks/desktop-mobile-sync.md) and [agents/plans/desktop-mobile-sync.md](agents/plans/desktop-mobile-sync.md).

The app is no longer designed to run as a Claude Artifact — that mode was only used early on to prototype and validate the idea, and is not maintained going forward. Pasting the file into an Artifact or React sandbox still renders the UI for a quick visual check, but nothing will persist there (no `window.storage` fallback). See [tasks/local-storage-migration.md](tasks/local-storage-migration.md) and [agents/plans/local-storage-migration.md](agents/plans/local-storage-migration.md) for why the migration dropped Artifact support instead of keeping a dual path.

### Running it

The app runs via the **local dev toolchain** (this repo has a minimal Vite scaffold for it) — see [README.md](README.md) for setup. This is a real local toolchain (`package.json`, Vite, Tailwind build) that mounts `App` from `hilo-finanzas.jsx` into `src/main.jsx`; it's plumbing only, not part of the app's own architecture. Data persists across reloads via IndexedDB, in both desktop and mobile browsers.

## Architecture

Everything lives in [hilo-finanzas.jsx](hilo-finanzas.jsx), organized top-to-bottom as:

1. **Design tokens & static data** — `COLORS`, `CATEGORY_PALETTE`, `ACCOUNT_TYPES`, `ICONS`/`ICON_CHOICES`, `DEFAULT_EXPENSE_CATEGORIES`/`DEFAULT_INCOME_CATEGORIES`/`DEFAULT_CATEGORIES`, `DEFAULT_ACCOUNTS`, and demo seed data (`buildDefaultTransactions`, `buildDefaultInstallmentPlans`) used on first load.
2. **Helpers** — pure functions: `uid`, date formatting (`todayIso`, `monthKey`, `monthLabel`, `formatDateLabel`), `formatMoney`, `computeAccountBalance`, `groupByDate`, `initialFormState`.
3. **Shared pieces** — `GlobalStyles` (fonts, scrollbar hiding, sheet animations), `SheetOverlay` (bottom-sheet modal shell), `Toast`, `EmptyState`, `ExpenseDonut` (+ `DonutTooltip`), `CategoryPicker`, `StoreInput`, `InstallmentPlanPicker`, `MsiPlanCard`, `TransactionRow`, `BottomNav`.
4. **Views** (one per bottom-nav tab) — `HomeView`, `HistoryView`, `AccountsView`, `MsiView`.
5. **Modals/sheets** — `AddTransactionSheet` (create/edit expense, income, or transfer), `AccountFormModal`, `MsiPlanModal`, `SettingsModal`, `MonefyImportModal`, `SyncModal` (manual cross-device merge), `BackupModal` (export / restore-by-replace).
6. **`App`** (default export) — owns *all* state (accounts, categories, transactions, installmentPlans, UI/nav/filter state, open modals) and every derived value via `useMemo`; passes data and callbacks down as props. There is no context, no reducer, no external state library — just one big component tree fed from the top.

### Desktop layout

Above `max-w-md` on a narrow viewport (< 1024px), `App` renders the mobile tree described above unchanged. At `>= 1024px` (`useIsDesktop()`, a `matchMedia` hook), `App` early-returns a **separate, parallel component tree** instead: `DesktopShell` (sidebar nav + wide main area) composing `DesktopSidebar` and `HomeViewDesktop`/`HistoryViewDesktop`/`AccountsViewDesktop`/`MsiViewDesktop` — desktop-specific layouts (multi-column grids, more visible at once) that accept the *same props* as their mobile counterparts, so `App`'s state/derived-data layer doesn't change at all between the two. `SheetOverlay` and `Toast` take a `desktop` prop to switch from mobile bottom-sheet/toast positioning to a centered modal / corner toast; every modal component (`AddTransactionSheet`, `AccountFormModal`, `MsiPlanModal`, `SettingsModal`, `MonefyImportModal`, `SyncModal`, `BackupModal`) just forwards it through. Both trees stay in this one file — see [tasks/desktop-view.md](tasks/desktop-view.md) and [agents/plans/desktop-view.md](agents/plans/desktop-view.md) for why a separate tree was chosen over a single responsive one.

### Domain model

- **Accounts** (`accounts`): `{ id, name, type, color, initialBalance }`. Balance is never stored — `computeAccountBalance` derives it by folding over all transactions every render.
- **Categories** (`categories`): `{ id, name, icon, color, type: 'expense' | 'income' }`, seeded from defaults, extendable inline from `CategoryPicker` anywhere it appears.
- **Transactions** (`transactions`), one of three `type`s:
  - `expense` — `{ accountId, categoryId, store, amount, date, description, installmentPlanId?, size?, brand?, quantity? }`. `installmentPlanId` lets a plain expense (not just a `transfer`, see below) be a payment toward an MSI plan — useful when the purchase isn't routed through a second "credit card" account. `size`/`brand`/`quantity` are optional product-detail metadata (editable in `AddTransactionSheet`, shown only when opening/editing a transaction, never in the compact history row).
  - `income` — `{ accountId, categoryId, amount, date, description }`.
  - `transfer` — `{ fromAccountId, toAccountId, amount, date, description, taggedAsExpense, categoryId, installmentPlanId, store, size?, brand?, quantity? }`. Transfers move money between accounts without affecting `totalBalance`. The key domain concept is **`taggedAsExpense`**: a transfer (typically "pay off the credit card") can be tagged so its amount counts toward category spending totals and shows up in expense reports, *without* subtracting from `totalBalance` a second time (the money already left an account as a transfer). This is how credit-card spend is tracked without double-counting. When `taggedAsExpense` is on, the transfer also accepts the same optional `size`/`brand`/`quantity` product-detail fields as an `expense` (edited in `AddTransactionSheet`, never shown in the compact history row); they're forced to `null` when the tag is off.
- **Installment plans / MSI** (`installmentPlans`) — "Meses sin intereses" (Mexican no-interest installment purchases): `{ id, description, store, totalAmount, installmentsCount, categoryId, startDate }`. A plan has no stored progress; `planProgress` (memoized in `App`) derives `paid`/`remaining`/`pct`/`isPaidOff` by summing every `transfer` **or `expense`** transaction whose `installmentPlanId` matches — partial or uneven payments are supported since progress is amount-based, not payment-count-based.
- Every record in the four collections above also carries `createdAt` and (for anything created or edited since the device-sync feature) `updatedAt` — millisecond epochs used as the last-write-wins tiebreaker when `SyncModal` merges two datasets by `id`. Records predating the feature fall back to `createdAt`.
- **Tombstones** (`tombstones`) — `[{ id, deletedAt }]`, a fifth persisted collection. Every delete handler pushes one so a later sync merge can propagate the deletion (a record is dropped when a tombstone's `deletedAt` is newer than the incoming record's `updatedAt`). Entries older than 180 days are pruned during a merge.

### State flow

- Load: on mount, `App` reads the state blob (keyed by `STORAGE_KEY`, `hilo_finanzas_data_v1`) from the `state` object store in the `hilo_finanzas` IndexedDB database via `loadState()`, hydrating `accounts`/`categories`/`transactions`/`installmentPlans`/`tombstones` if present, else keeps the seeded demo data.
- Save: a single `useEffect` watches all five collections and writes the whole state back via `saveState()` on every change (post-load); a failed write (IndexedDB unavailable or erroring) surfaces as a `Toast`, it no longer fails silently.
- Cross-device transfer helpers (near the Monefy import block): `buildExportPayload` wraps the five collections in `{ app, schema, exportedAt, data }`; `gzipString`/`gunzipBytes` (native `CompressionStream`) back the `hilo1:`-prefixed text and the QR bytes; `mergeDataState` (merge by `id` + tombstones) and `replaceDataState` (full replace) are the two ways an incoming payload is applied.
- All month-scoped views (`HomeView`, totals, `categoryTotals`) filter by `monthKey(monthCursor)` (`YYYY-MM` prefix match on `date`); `HistoryView` can additionally toggle `showAllTime` and filter by type/category/store.
- Editing a transaction reuses `AddTransactionSheet` with `editingId` set; deleting requires an inline confirm step (`confirmDelete`) rather than a browser `confirm()`.

## Keeping specs and plans in sync with the code

Implementation plans for tasks live in `agents/plans/`, generally one file per entry in `tasks/` (e.g. [agents/plans/desktop-view.md](agents/plans/desktop-view.md) implements [tasks/desktop-view.md](tasks/desktop-view.md)).

A plan is a snapshot of the intended approach at the time it was written. If the implementation ends up deviating from it, or a later change touches code a plan describes, **update that plan file in the same change** so it reflects current reality — don't leave it stale. A plan that no longer matches the code is worse than no plan at all, since it actively misleads whoever reads it next (human or Claude).

When a task is finished: update its plan as above, flip its `status` in `tasks/<name>.md` frontmatter (vocabulary in [tasks/README.md](tasks/README.md): `pendiente` / `en-progreso` / `implementada`), and reflect that status change in the table in `tasks/README.md`.
