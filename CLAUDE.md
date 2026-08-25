# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Hilo" is a personal finance tracker (Mexican Spanish UI, MXN currency), built as a **single self-contained React component** ([hilo-finanzas.jsx](hilo-finanzas.jsx)) that exports a default `App` and is styled with Tailwind utility classes and inline style objects. There's no linter or test suite, and no other source files besides the local-dev scaffold described below — all product logic lives in that one `.jsx` file.

### Product direction: local-only SPA, no backend

The intent, at least for now, is for Hilo to stay a **client-only single-page app with no backend**. There is no server, no API, no sync — everything a user enters should be stored **locally in their own browser**. The persistence mechanism is not finalized yet (IndexedDB is the leading candidate over plain `localStorage`, given the amount of structured data), so don't assume a specific storage API is settled — check [hilo-finanzas.jsx](hilo-finanzas.jsx) for the current implementation before relying on it.

Right now the component still uses `window.storage.get` / `window.storage.set`, the **Claude Artifact host API** — not `localStorage`/IndexedDB and not a backend. This only works when the file is rendered inside a published Claude Artifact; when run via the local dev server (see below), those calls fail silently and nothing persists across reloads (there is no in-app warning about this — it's expected while the app only runs as an Artifact or in local dev). Migrating this to a real browser-local storage mechanism (IndexedDB or similar) is expected future work, not yet done.

### Running it

Two ways to view the app, both driven by the same [hilo-finanzas.jsx](hilo-finanzas.jsx):

- **Local dev (this repo has a minimal Vite scaffold for it)** — see [README.md](README.md) for setup. This is a real local toolchain (`package.json`, Vite, Tailwind build) that mounts `App` from `hilo-finanzas.jsx` into `src/main.jsx`; it's plumbing only, not part of the app's own architecture. Data won't persist between reloads yet (see above).
- **As a Claude Artifact** — publish `hilo-finanzas.jsx` as an Artifact to get working persistence via `window.storage`, or paste it into a React sandbox with `lucide-react` and `recharts` available for a quick visual check without installing anything.

## Architecture

Everything lives in [hilo-finanzas.jsx](hilo-finanzas.jsx), organized top-to-bottom as:

1. **Design tokens & static data** — `COLORS`, `CATEGORY_PALETTE`, `ACCOUNT_TYPES`, `ICONS`/`ICON_CHOICES`, `DEFAULT_EXPENSE_CATEGORIES`/`DEFAULT_INCOME_CATEGORIES`/`DEFAULT_CATEGORIES`, `DEFAULT_ACCOUNTS`, and demo seed data (`buildDefaultTransactions`, `buildDefaultInstallmentPlans`) used on first load.
2. **Helpers** — pure functions: `uid`, date formatting (`todayIso`, `monthKey`, `monthLabel`, `formatDateLabel`), `formatMoney`, `computeAccountBalance`, `groupByDate`, `initialFormState`.
3. **Shared pieces** — `GlobalStyles` (fonts, scrollbar hiding, sheet animations), `SheetOverlay` (bottom-sheet modal shell), `Toast`, `EmptyState`, `ExpenseDonut` (+ `DonutTooltip`), `CategoryPicker`, `StoreInput`, `InstallmentPlanPicker`, `MsiPlanCard`, `TransactionRow`, `BottomNav`.
4. **Views** (one per bottom-nav tab) — `HomeView`, `HistoryView`, `AccountsView`, `MsiView`.
5. **Modals/sheets** — `AddTransactionSheet` (create/edit expense, income, or transfer), `AccountFormModal`, `MsiPlanModal`, `SettingsModal`.
6. **`App`** (default export) — owns *all* state (accounts, categories, transactions, installmentPlans, UI/nav/filter state, open modals) and every derived value via `useMemo`; passes data and callbacks down as props. There is no context, no reducer, no external state library — just one big component tree fed from the top.

### Desktop layout

Above `max-w-md` on a narrow viewport (< 1024px), `App` renders the mobile tree described above unchanged. At `>= 1024px` (`useIsDesktop()`, a `matchMedia` hook), `App` early-returns a **separate, parallel component tree** instead: `DesktopShell` (sidebar nav + wide main area) composing `DesktopSidebar` and `HomeViewDesktop`/`HistoryViewDesktop`/`AccountsViewDesktop`/`MsiViewDesktop` — desktop-specific layouts (multi-column grids, more visible at once) that accept the *same props* as their mobile counterparts, so `App`'s state/derived-data layer doesn't change at all between the two. `SheetOverlay` and `Toast` take a `desktop` prop to switch from mobile bottom-sheet/toast positioning to a centered modal / corner toast; the four modal components (`AddTransactionSheet`, `AccountFormModal`, `MsiPlanModal`, `SettingsModal`) just forward it through. Both trees stay in this one file — see [tasks/desktop-view.md](tasks/desktop-view.md) and [agents/plans/desktop-view.md](agents/plans/desktop-view.md) for why a separate tree was chosen over a single responsive one.

### Domain model

- **Accounts** (`accounts`): `{ id, name, type, color, initialBalance }`. Balance is never stored — `computeAccountBalance` derives it by folding over all transactions every render.
- **Categories** (`categories`): `{ id, name, icon, color, type: 'expense' | 'income' }`, seeded from defaults, extendable inline from `CategoryPicker` anywhere it appears.
- **Transactions** (`transactions`), one of three `type`s:
  - `expense` — `{ accountId, categoryId, store, amount, date, description }`.
  - `income` — `{ accountId, categoryId, amount, date, description }`.
  - `transfer` — `{ fromAccountId, toAccountId, amount, date, description, taggedAsExpense, categoryId, installmentPlanId, store }`. Transfers move money between accounts without affecting `totalBalance`. The key domain concept is **`taggedAsExpense`**: a transfer (typically "pay off the credit card") can be tagged so its amount counts toward category spending totals and shows up in expense reports, *without* subtracting from `totalBalance` a second time (the money already left an account as a transfer). This is how credit-card spend is tracked without double-counting.
- **Installment plans / MSI** (`installmentPlans`) — "Meses sin intereses" (Mexican no-interest installment purchases): `{ id, description, store, totalAmount, installmentsCount, categoryId, startDate }`. A plan has no stored progress; `planProgress` (memoized in `App`) derives `paid`/`remaining`/`pct`/`isPaidOff` by summing every `transfer` transaction whose `installmentPlanId` matches — partial or uneven payments are supported since progress is amount-based, not payment-count-based.

### State flow

- Load: on mount, `App` reads `STORAGE_KEY` (`hilo_finanzas_data_v1`) from `window.storage`, hydrating `accounts`/`categories`/`transactions`/`installmentPlans` if present, else keeps the seeded demo data.
- Save: a single `useEffect` watches all four collections and writes the whole state back to `window.storage` as one JSON blob on every change (post-load).
- All month-scoped views (`HomeView`, totals, `categoryTotals`) filter by `monthKey(monthCursor)` (`YYYY-MM` prefix match on `date`); `HistoryView` can additionally toggle `showAllTime` and filter by type/category/store.
- Editing a transaction reuses `AddTransactionSheet` with `editingId` set; deleting requires an inline confirm step (`confirmDelete`) rather than a browser `confirm()`.

## Keeping specs and plans in sync with the code

Implementation plans for tasks live in `agents/plans/`, generally one file per entry in `tasks/` (e.g. [agents/plans/desktop-view.md](agents/plans/desktop-view.md) implements [tasks/desktop-view.md](tasks/desktop-view.md)).

A plan is a snapshot of the intended approach at the time it was written. If the implementation ends up deviating from it, or a later change touches code a plan describes, **update that plan file in the same change** so it reflects current reality — don't leave it stale. A plan that no longer matches the code is worse than no plan at all, since it actively misleads whoever reads it next (human or Claude).

When a task is finished: update its plan as above, flip its `status` in `tasks/<name>.md` frontmatter (vocabulary in [tasks/README.md](tasks/README.md): `pendiente` / `en-progreso` / `implementada`), and reflect that status change in the table in `tasks/README.md`.
