# Plan: agregar testing (red de seguridad pre-refactor)

Implementa [tasks/testing.md](../../tasks/testing.md). Objetivo: cubrir el comportamiento
actual de Hilo con tests automáticos para poder refactorizar hacia
[arquitectura en capas](layered-architecture.md) sin cambiar comportamiento sin querer.

## Decisiones

- **Runner: Vitest** (el repo ya usa Vite; integra sin config extra). Entorno `jsdom`.
- **Dos niveles:** unit sobre funciones puras importadas de `hilo-finanzas.jsx`, e
  integración montando `<App/>` con React Testing Library + `fake-indexeddb`.
- **Se congela el comportamiento observable actual**, aunque tenga rarezas. Si algo
  parece un bug se anota, pero el test documenta lo que hace hoy.
- **Refactor mínimo, sin cambio de comportamiento**, para hacer testeable la lógica:
  - `export` en los helpers puros que ya existían.
  - Los cuerpos de los `useMemo` de `App` se movieron a funciones puras exportadas
    (`computeBalances`, `computeTotalBalance`, `computePeriodTransactions`,
    `computeTotalIncome`, `computeTotalExpense`, `computeCategoryTotals`,
    `computeRecentTxns`, `computePlanProgress`, `computeKnownStores`,
    `computeHistorySuggestions`); cada `useMemo` ahora sólo las invoca.
  - El filtro del Historial estaba **duplicado** en `HistoryView` y
    `HistoryViewDesktop`; se extrajo a `filterHistoryTransactions(...)` y ambas
    vistas lo llaman.
  - Se añadieron `aria-label` a botones que sólo tenían ícono (FAB de agregar,
    pager de mes y limpiar-búsqueda del Historial, papelera de movimiento/cuenta,
    engrane de Ajustes). Mejora de accesibilidad, además de hacer los tests
    robustos.
  - **No** se hizo el split de archivos: sigue todo en `hilo-finanzas.jsx`.

## Infra

- `vite.config.js`: bloque `test` (`environment: 'jsdom'`, `globals: true`,
  `setupFiles: ['./src/test/setup.js']`, `include: ['test/**/*.test.{js,jsx}']`,
  coverage v8 sobre `hilo-finanzas.jsx`).
- `src/test/setup.js`:
  - `@testing-library/jest-dom`, `fake-indexeddb/auto`, `cleanup()` por test,
    `indexedDB` nuevo por test.
  - `Blob`/`File` de `node:buffer` (la Blob de jsdom no trae `.stream()` ni
    `.arrayBuffer()`, y `gzipString`/`gunzipBytes` los usan).
  - `FileReader` polyfill mínimo (con Blob/File de Node, el de jsdom no los lee):
    `readAsText`/`readAsDataURL` sobre `blob.text()` / `blob.arrayBuffer()`.
  - `ResizeObserver` stub (lo pide el `ResponsiveContainer` de recharts).
  - `matchMedia` mock (default móvil) y `window.innerWidth = 375` (por
    `useIsDesktop`, que en jsdom arrancaría en 1024 = escritorio).
  - Filtro del `console.warn` "width(0) and height(0) of chart" de recharts.
- `package.json`: `test` (`vitest run`), `test:watch`, `test:cov`.
- devDependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`,
  `@testing-library/{react,dom,user-event,jest-dom}`, `fake-indexeddb`.

## Suites (190 tests)

Unit (`test/unit/`):

| Archivo | Cubre |
| --- | --- |
| `helpers.test.js` | `formatMoney`, fechas (`todayIso`/`monthKey`/`monthLabel`/`formatDateLabel`), `normalizeForSearch`/`accountNameMatches`/`highlightMatch`, `computeAccountBalance`, `groupByDate`, `initialFormState`, `recordStamp`, `uid` |
| `domain.test.js` | `computePlanProgress` (pagos parciales/desiguales, `installmentsCount` fraccionario, epsilon 0.005, total 0), totales de periodo, `computeCategoryTotals`, balances, `filterHistoryTransactions` (mes/todo, tipo incl. `msi`, categoría, tienda, búsqueda, composición) |
| `sync.test.js` | `buildExportPayload` (completo vs delta), `normalizeExportPayload`, `parseExportText` (JSON y `hilo1:`), base64/gzip round-trip, `mergeCollection` (added/updated/removed, empates, tombstones), `mergeTombstones` (TTL, dedupe), `mergeDataState` (parcial ≡ completo, convergencia LWW), `replaceDataState` |
| `monefy.test.js` | `parseCsv`, `parseMonefyDate`/`Amount`, `classifyMonefyCategory`, `parseMonefyRows`, `guessAccountType`/`guessCategoryIcon`, `parseOscarDescription` (fracción `(N/D)`/`[N/D]`, guiones), `buildMonefyImportPreview` (fantasmas, initial balance, emparejar transferencias, series MSI), `buildMonefyImportPlan` (reusar por nombre, `include:false`, convención Oscar) |
| `receipt.test.js` | `isValidIsoDate`, `buildReceiptDraft` (mapeo, categoría fallback, descuentos, fecha inválida, invariante del ticket), `scanReceipt` (401/429/otros/sin red/sin `tool_use`/happy path con `fetch` mockeado) |
| `persistence.test.js` | `loadState`/`saveState` round-trip, OCR settings (borra si vacío, clave aparte), sync state (`makeSyncState`, poda de peers por `PEER_TTL_MS`, aislamiento de `STORAGE_KEY`) |
| `backcompat.test.js` | registros sin `updatedAt` (cae a `createdAt`), blob sin `tombstones`, export pre-delta (sin `device`/`partial`/`since`) merge-equivalente |

Integración (`test/integration/`, montan `<App/>`):

| Archivo | Flujos |
| --- | --- |
| `transactions.test.jsx` | alta de gasto/ingreso/transferencia, transferencia `taggedAsExpense` (cuenta como gasto sin doble descuento), editar, eliminar (confirm inline + tombstone), monto conservado al cambiar de tipo |
| `msi.test.jsx` | crear pago vinculado a un plan → progreso parcial; cubrir el total → "Ya pagados" / "Pagado ✓" |
| `history.test.jsx` | vista por mes, filtro por tipo, filtro por categoría (select), buscador (todo el tiempo, pager deshabilitado, `<mark>`, limpiar) |
| `accounts.test.jsx` | alta, edición (recalcula saldo), guard de borrado (con movimientos = deshabilitado), borrado con confirmación |
| `sync-backup.test.jsx` | recibir por texto pegado (merge + toast + reflejo en UI), restaurar respaldo desde archivo (reemplaza todo) |
| `monefy-import.test.jsx` | Ajustes → Importar → subir CSV → revisión → confirmar → movimientos/cuenta agregados |
| `receipt.test.jsx` | Escanear ticket con `fetch`/`Image` mockeados → revisión → confirmar → gastos + descuento como ingreso en "Descuentos" (creada al vuelo) |

## Cómo correrlo

```
npm test          # una pasada
npm run test:watch
npm run test:cov  # cobertura sobre hilo-finanzas.jsx
```

## Notas / limitaciones

- Nada depende de la hora real: se usa `vi.setSystemTime` donde importa
  (`formatDateLabel`, `todayIso`, tombstones) y marcas relativas a `Date.now()`
  donde hay IndexedDB de por medio (los fake timers rompen los callbacks de
  `fake-indexeddb`).
- Los tests de subir archivo usan `fireEvent.change` sobre el `<input type=file>`
  (oculto) en vez de `user.upload`.
- Siguiente paso natural: [layered-architecture.md](layered-architecture.md), ya con
  la red puesta. Al mover estas funciones a `src/domain/`, los tests unit sólo
  cambian el import.
