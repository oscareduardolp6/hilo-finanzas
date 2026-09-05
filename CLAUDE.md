# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Hilo" is a personal finance tracker (Mexican Spanish UI, MXN currency), styled with Tailwind utility classes and inline style objects. There's no linter. npm deps are `react`/`react-dom`, `recharts` (charts), `lucide-react` (icons), `qrcode` + `jsqr` (device-sync QR encode/decode), plus `fp-ts` and `zustand` (see the architecture section).

> ### ⚠️ Refactor en curso — lee esto antes de tocar código
>
> Hilo **era** un solo componente React de 4721 líneas. Se está migrando a una arquitectura en capas feature-first: ver [tasks/layered-architecture.md](tasks/layered-architecture.md) y, sobre todo, el **registro de avance** en [agents/plans/layered-architecture.md](agents/plans/layered-architecture.md), que dice exactamente qué módulos ya se movieron y cuáles siguen en el legacy. **Ese registro es la fuente de verdad**; esta sección describe el objetivo.
>
> Mientras dure el refactor conviven dos mundos:
> - `src/legacy/hilo-legacy.jsx` — lo que todavía no se migra. Se vacía commit a commit.
> - `src/shared/` y `src/features/` — el código ya migrado, en TypeScript.
> - [hilo-finanzas.jsx](hilo-finanzas.jsx) — **barrel**: solo re-exports, sin lógica. Existe para que `src/main.jsx` y los tests importen desde una ruta estable. Cuando migres un símbolo, cambia el origen de su línea aquí; nunca uses `export *`.

There **is** a test suite: Vitest + React Testing Library + `fake-indexeddb`, run with `npm test`. Está en dos lugares:

- `test/unit/` y `test/integration/` — la suite de regresión pre-refactor (190 tests). **No se toca durante el refactor**: es la prueba de que mover código no cambió comportamiento. Si uno falla, es un cambio de comportamiento real, no un test desactualizado.
- `src/**/*.test.{ts,tsx}` — los tests nuevos, junto a la feature que prueban: casos de uso corridos con dependencias en memoria, y componentes de feature como punto de entrada (sin montar `<App/>`). Para los de UI, usa `renderFeature` de [src/test/render-feature.tsx](src/test/render-feature.tsx): monta **un** container con repositorios en memoria y reloj/ids fijos, así el test es atómico de su feature y sus `createdAt` son comparables.

Además de `npm test`, corre `npm run typecheck` (TypeScript 7, `tsc --noEmit`). When you change product behavior, update or add the matching test; when you change it *deliberately*, the failing test is the checklist of what you're changing.

### Product direction: local-only SPA, no backend

The intent, at least for now, is for Hilo to stay a **client-only single-page app with no backend**. There is no server and no API — everything a user enters is stored **locally in their own browser**, via IndexedDB (native `indexedDB` API, no wrapper library — see `openDb`/`loadState`/`saveState` in [src/shared/infrastructure/indexed-db.ts](src/shared/infrastructure/indexed-db.ts), y los puertos que las envuelven en [repositories.ts](src/shared/infrastructure/repositories.ts)). This is what makes the app work as a real local tool in a normal browser (dev build or eventually a deployed static build), independent of any host. Cross-device sync is **manual and backend-free**: `SyncModal` exports the state blob as a file / compressed-text string / QR and merges an incoming one by `id`; `BackupModal` exports the same blob and restores it by full replace. Todo lo que eso necesita del navegador — leer un archivo, copiar, compartir, bajar un JSON, pintar y escanear un QR — entra por puertos inyectados en `Deps` (ver [src/shared/domain/ports.ts](src/shared/domain/ports.ts)), no se llama desde el componente. See [tasks/desktop-mobile-sync.md](tasks/desktop-mobile-sync.md) and [agents/plans/desktop-mobile-sync.md](agents/plans/desktop-mobile-sync.md).

The **one exception** is receipt scanning (`ReceiptScanModal`, see [tasks/receipt-ocr.md](tasks/receipt-ocr.md) / [agents/plans/receipt-ocr.md](agents/plans/receipt-ocr.md)): it calls the Anthropic vision API **directly from the browser** with an API key + model the user pastes in `SettingsModal`. There is still no project server, but it's no longer true that nothing leaves the browser — the ticket photo is sent to Anthropic. The key/model live under their own IndexedDB key (`OCR_SETTINGS_STORAGE_KEY`, via `loadOcrSettings`/`saveOcrSettings`), never inside the `STORAGE_KEY` blob, so they're excluded from sync / QR / backup by construction.

The app is no longer designed to run as a Claude Artifact — that mode was only used early on to prototype and validate the idea, and is not maintained going forward. Pasting the file into an Artifact or React sandbox still renders the UI for a quick visual check, but nothing will persist there (no `window.storage` fallback). See [tasks/local-storage-migration.md](tasks/local-storage-migration.md) and [agents/plans/local-storage-migration.md](agents/plans/local-storage-migration.md) for why the migration dropped Artifact support instead of keeping a dual path.

### Running it

The app runs via the **local dev toolchain** (this repo has a minimal Vite scaffold for it) — see [README.md](README.md) for setup. This is a real local toolchain (`package.json`, Vite, Tailwind build) that mounts `App` (vía el barrel `hilo-finanzas.jsx`) into `src/main.jsx`; it's plumbing only, not part of the app's own architecture. Data persists across reloads via IndexedDB, in both desktop and mobile browsers.

## Architecture

### Arquitectura objetivo (a la que se está migrando)

Feature-first: la funcionalidad es el primer nivel, y dentro de cada una van las capas.

```
src/app/          App, store de zustand, Provider, dependencies (composition root), run
src/shared/       fp/ · domain/ · design/ · infrastructure/ · ui/    ← lo importa cualquiera
src/features/<f>/ domain/ · application/ · infrastructure/ · store/ · ui/{components,containers}
src/legacy/       lo que todavía no se migra
```

Cuatro reglas que gobiernan el código nuevo:

1. **Dirección de dependencias:** `ui → store → application → domain`. Una feature puede importar el `domain/` y los `store/selectors` de otra, **nunca su `ui/`**. `shared/` no importa nada de `features/`.
2. **Casos de uso = funciones que devuelven un valor,** con las mónadas de fp-ts: `Reader<Deps, A>` si es determinista, `ReaderIO<Deps, A>` si necesita id o reloj, `ReaderTaskEither<Deps, HiloError, A>` si es asíncrono y falible. Un caso de uso **no ejecuta nada** al invocarlo.
3. **Un solo punto de run:** la acción del slice de zustand. Es el único lugar que llama `runRIO`/`runRTE` (de `src/app/run.ts`) y el único que hace `match` del `Either`. **Ningún componente ve una mónada.** Si un componente corriera una, tendríamos dos modelos de efectos compitiendo — es lo único que hay que vigilar en review.
4. **Funciones, no clases.** Los repositorios son records de funciones con dos implementaciones: la real sobre IndexedDB y una en memoria para test.

Componentes de **renderizado** (`ui/components/`) reciben props y devuelven JSX, sin store ni casos de uso. Componentes de **lógica** (`ui/containers/`) leen el store, ligan acciones y componen a los primeros.

### Lo que todavía vive en el legacy

[src/legacy/hilo-legacy.jsx](src/legacy/hilo-legacy.jsx) — consulta el registro de avance del plan para saber qué queda. Organizado top-to-bottom como (los helpers de dominio y las cuatro vistas de pestaña ya no están: cada una se fue con su feature):

1. **Static data** — `DEFAULT_EXPENSE_CATEGORIES`/`DEFAULT_INCOME_CATEGORIES`/`DEFAULT_CATEGORIES`, `DEFAULT_ACCOUNTS`, and demo seed data (`buildDefaultTransactions`, `buildDefaultInstallmentPlans`) used on first load. *(Los tokens de diseño y el catálogo de iconos ya migraron a `src/shared/design/`.)*
2. **Shared pieces** — `GlobalStyles` (fonts, scrollbar hiding, sheet animations), `Toast`, `BottomNav`. *(La dona `ExpenseDonut` y su `DonutTooltip` se fueron con la feature `dashboard`: solo Inicio las pinta.)* *(Los presentacionales que ya usan varias features viven en `src/shared/ui/`: `SheetOverlay`, `EmptyState`, `CategoryPicker`, `StoreInput`, `AccountChips`, `InstallmentPlanPicker`, `TransactionRow`, `MsiPlanCard` — ver la regla en el plan.)*
3. **Modals/sheets** — `SettingsModal`, `MonefyImportModal`, `ReceiptScanModal` (photo → Anthropic vision API → review sheet → many transactions), `BackupModal` (export / restore-by-replace). *(`SyncModal` ya es la feature `sync`: tabs* Enviar */* Recibir */* Dispositivos*, la última gestionando el nombre de este dispositivo y los puntos de sincronización por peer que gobiernan los envíos delta.)*
4. **`App`** (default export) — hoy es solo un envoltorio sobre `HiloStoreProvider`; el árbol vive en `AppBody`, que **ya no es dueño de ningún estado ni deriva nada**: de los 29 `useState` y los diez `useMemo` originales no queda ninguno. Lee del store lo que los modales sin migrar todavía necesitan y se lo baja como props.

### Desktop layout

Above `max-w-md` on a narrow viewport (< 1024px), `App` renders the mobile tree described above unchanged. At `>= 1024px` (`useIsDesktop()`, a `matchMedia` hook), `App` early-returns a **separate, parallel component tree** instead: `DesktopShell` (sidebar nav + wide main area) composing `DesktopSidebar` and the desktop counterpart of whatever tab is active — desktop-specific layouts (multi-column grids, more visible at once) that take the *same props* as their mobile counterparts — hoy eso lo garantiza el container de cada feature, que elige una u otra según `desktop`. `SheetOverlay` and `Toast` take a `desktop` prop to switch from mobile bottom-sheet/toast positioning to a centered modal / corner toast; every modal component (`SettingsModal`, `MonefyImportModal`, `ReceiptScanModal`, `SyncModal`, `BackupModal`) just forwards it through. See [tasks/desktop-view.md](tasks/desktop-view.md) and [agents/plans/desktop-view.md](agents/plans/desktop-view.md) for why a separate tree was chosen over a single responsive one.

**Lo que cambia según se migra cada feature:** una feature ya migrada no aparece dos veces en ese cableado. Los dos árboles montan **el mismo container** y le pasan `desktop`; el container elige la vista y se sirve del store, sin recibir props. Así lo hacen las cuatro pestañas: `dashboard` (`HomeContainer`), `history` (`HistoryContainer`), `installments` (`MsiContainer` / `MsiPlanFormContainer`) y `accounts` (`AccountsContainer` / `AccountFormContainer`), más `transactions` (`AddTransactionContainer`) y `sync` (`SyncContainer`). `DesktopShell` ha bajado de ~60 props a 29, y las que quedan son de los modales sin migrar. El paso 12 termina de vaciarlo.

### Domain model

- **Accounts** (`accounts`): `{ id, name, type, color, initialBalance }`. Balance is never stored — `computeAccountBalance` ([src/features/accounts/domain/balance.ts](src/features/accounts/domain/balance.ts)) derives it by folding over all transactions every render. Una cuenta con movimientos no se puede borrar (`accountHasTransactions`).
- **Categories** (`categories`): `{ id, name, icon, color, type: 'expense' | 'income' }`, seeded from defaults, extendable inline from `CategoryPicker` anywhere it appears. One seeded income category, `Descuentos`, is special: `ReceiptScanModal` records each ticket-level discount as an `income` in this category (line items stay at list price, so `subtotal − discount = amount paid` nets out on `totalBalance`), which lets the user later total up how much they saved. `handleAddReceiptTransactions` re-creates the category on demand for profiles that predate this seed.
- **Transactions** (`transactions`), one of three `type`s:
  - `expense` — `{ accountId, categoryId, store, amount, date, description, installmentPlanId?, size?, brand?, quantity? }`. `installmentPlanId` lets a plain expense (not just a `transfer`, see below) be a payment toward an MSI plan — useful when the purchase isn't routed through a second "credit card" account. `size`/`brand`/`quantity` are optional product-detail metadata (editable in `AddTransactionSheet`, shown only when opening/editing a transaction, never in the compact history row).
  - `income` — `{ accountId, categoryId, amount, date, description }`.
  - `transfer` — `{ fromAccountId, toAccountId, amount, date, description, taggedAsExpense, categoryId, installmentPlanId, store, size?, brand?, quantity? }`. Transfers move money between accounts without affecting `totalBalance`. The key domain concept is **`taggedAsExpense`**: a transfer (typically "pay off the credit card") can be tagged so its amount counts toward category spending totals and shows up in expense reports, *without* subtracting from `totalBalance` a second time (the money already left an account as a transfer). This is how credit-card spend is tracked without double-counting. When `taggedAsExpense` is on, the transfer also accepts the same optional `size`/`brand`/`quantity` product-detail fields as an `expense` (edited in `AddTransactionSheet`, never shown in the compact history row); they're forced to `null` when the tag is off.
- **Installment plans / MSI** (`installmentPlans`) — "Meses sin intereses" (Mexican no-interest installment purchases): `{ id, description, store, totalAmount, installmentsCount, categoryId, startDate }`. A plan has no stored progress; `computePlanProgress` ([src/features/installments/domain/progress.ts](src/features/installments/domain/progress.ts)) derives `paid`/`remaining`/`pct`/`isPaidOff` by summing every `transfer` **or `expense`** transaction whose `installmentPlanId` matches — partial or uneven payments are supported since progress is amount-based, not payment-count-based. `installmentsCount` is parsed with `parseFloat` (not `parseInt`) in both plan forms, so it can be fractional — e.g. `1.5` to model paying a credit-card charge across 3 quincenas ("1.5 months") rather than whole months; `per` and the `installmentsPaid` display just divide, so decimals flow through the rest of the math unchanged.
- Every record in the four collections above also carries `createdAt` and (for anything created or edited since the device-sync feature) `updatedAt` — millisecond epochs used as the last-write-wins tiebreaker when `SyncModal` merges two datasets by `id`. Records predating the feature fall back to `createdAt`.
- **Tombstones** (`tombstones`) — `[{ id, deletedAt }]`, a fifth persisted collection. Every delete — handler legacy o caso de uso migrado — pushes one so a later sync merge can propagate the deletion (a record is dropped when a tombstone's `deletedAt` is newer than the incoming record's `updatedAt`). Entries older than 180 days are pruned during a merge.

### State flow

- Load: on mount, `HiloStoreProvider` runs the `hydrate` use case ([src/app/application/hydrate.ts](src/app/application/hydrate.ts)), which reads the state blob (keyed by `STORAGE_KEY`, `hilo_finanzas_data_v1`) from the `state` object store in the `hilo_finanzas` IndexedDB database, hydrating `accounts`/`categories`/`transactions`/`installmentPlans`/`tombstones` if present, else keeping the seeded demo data. Es un `ReaderTask`, no un `ReaderTaskEither`: la hidratación no puede fallar de cara al usuario — si IndexedDB no responde se arranca con los datos de ejemplo, sin error.
- Save: una suscripción del store ([src/app/persistence.ts](src/app/persistence.ts)) observa las cinco colecciones y corre el caso de uso `persist` en cada cambio (post-hidratación); un fallo de escritura (IndexedDB caído o con error) sale como `Toast`, no en silencio. Reproduce un detalle del `useEffect` que sustituyó: **también dispara cuando `loaded` pasa a `true`**, que es lo que persiste la semilla de demo en un perfil nuevo.
- Cross-device transfer helpers (near the Monefy import block): `buildExportPayload(state, { device, since })` wraps the five collections in `{ app, schema, exportedAt, device, partial, since, data }`; `gzipString`/`gunzipBytes` (native `CompressionStream`) back the `hilo1:`-prefixed text and the QR bytes; `mergeDataState` (merge by `id` + tombstones) and `replaceDataState` (full replace) are the two ways an incoming payload is applied.
- **Incremental (delta) sync.** With `since` (an epoch), `buildExportPayload` filters each collection to `recordStamp(r) > since - SYNC_SKEW_MARGIN_MS` (and tombstones by `deletedAt`), producing a small **partial** payload — the point of it is to fit a QR once the full history no longer does. The receiver needs no special handling: `mergeDataState` already folds a partial payload by `id` the same way (a record's *absence* is never a deletion — those only travel as tombstones), so full and delta merges are identical in effect. Each device keeps a **local-only** sync state under `SYNC_STATE_STORAGE_KEY` (`hilo_sync_state_v1`), same pattern as OCR settings — never in the `STORAGE_KEY` blob, so it's excluded from sync/QR/backup by construction. Shape: `{ deviceId, deviceName, peers: { [peerId]: { name, lastSentAt, lastReceivedAt } } }`. `lastSentAt` (advanced *manually* via SyncModal's "marcar como enviado", after a confirmed transfer) gates what the *next* delta to that peer contains; `lastReceivedAt` (advanced *automatically* on a successful receive, to the incoming payload's `exportedAt`) is informational. Lo arranca `hydrate` (vía `loadSyncState`/`makeSyncState`) y lo persiste la misma suscripción del store con `saveSyncState`, que poda los peers inactivos > `PEER_TTL_MS` (365 días). See [tasks/sync-incremental.md](tasks/sync-incremental.md) and [agents/plans/sync-incremental.md](agents/plans/sync-incremental.md).
- All month-scoped views (`HomeView`, totals, `categoryTotals` — ver [src/features/dashboard/](src/features/dashboard/)) filter by `monthKey(monthCursor)` (`YYYY-MM` prefix match on `date`); `HistoryView` can additionally toggle `showAllTime` and filter by type/category/store (ver [src/features/history/](src/features/history/)). It also has a free-text search box (`searchQuery`, efímero en el store — no se persiste, como los demás filtros) that matches — accent- and case-insensitively (`normalizeForSearch`, shared with the account picker search) — against a transaction's `description`, `store`, and the `description`/`store` of its linked MSI plan; while there's a query the search is always all-time (the month pager and `showAllTime` toggle are disabled) and it composes on top of the type/category/store filters. Matches are highlighted in `TransactionRow` via its optional `query` prop (`highlightMatch`).
- Editing a transaction reuses `AddTransactionSheet` with `editingId` set; deleting requires an inline confirm step (`confirmDelete`) rather than a browser `confirm()`.

### Backward compatibility with saved data

Hilo now has real users with data already persisted in their browser's IndexedDB (the `STORAGE_KEY` blob). There is no backend, no migration service, and no way for us to reach that data and fix it up — whatever shape it was written in is the shape it loads back in on that user's next visit. So from here on every change has to assume a pre-existing dataset and not break it:

- **Never assume a field is present.** Records written by older builds won't have fields added later (`updatedAt`, product-detail `size`/`brand`/`quantity`, anything future). Read defensively (`?.`, `|| fallback`) — the way `updatedAt` falls back to `createdAt`, and `handleAddReceiptTransactions` re-creates the `Descuentos` category for profiles that predate its seed.
- **Don't change the meaning or type of an existing field in place.** Widening is safe (e.g. MSI `installmentsCount` moving from `parseInt` to `parseFloat`: old integer values keep working untouched, only new input gains decimals). Renaming, narrowing, or repurposing a field silently corrupts already-saved data — do a keyed migration on load instead, and only then bump the `_v1` suffix on `STORAGE_KEY` if the shape genuinely breaks.
- **New persisted collections must tolerate being absent on load** (hydrate to a sensible default), the way `tombstones` was added as a fifth collection without invalidating older blobs.
- The same caution applies to any payload `SyncModal` / `BackupModal` imports and to `mergeDataState` / `replaceDataState` — it may have been exported by an older build than the one reading it. `normalizeExportPayload` treats the envelope fields added for delta sync (`device`, `partial`, `since`, `exportedAt`) as optional: a pre-delta export just yields `device: null` / `partial: false`, no peer is recorded on receive, and the merge is unchanged.

## Keeping specs and plans in sync with the code

Implementation plans for tasks live in `agents/plans/`, generally one file per entry in `tasks/` (e.g. [agents/plans/desktop-view.md](agents/plans/desktop-view.md) implements [tasks/desktop-view.md](tasks/desktop-view.md)).

A plan is a snapshot of the intended approach at the time it was written. If the implementation ends up deviating from it, or a later change touches code a plan describes, **update that plan file in the same change** so it reflects current reality — don't leave it stale. A plan that no longer matches the code is worse than no plan at all, since it actively misleads whoever reads it next (human or Claude).

When a task is finished: update its plan as above, flip its `status` in `tasks/<name>.md` frontmatter (vocabulary in [tasks/README.md](tasks/README.md): `pendiente` / `en-progreso` / `implementada`), and reflect that status change in the table in `tasks/README.md`.
