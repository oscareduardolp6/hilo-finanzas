/* ------------------------------------------------------------------ */
/* Barrel: API pública de Hilo                                         */
/* ------------------------------------------------------------------ */
/* Este archivo no contiene lógica: solo re-exporta. Existe para que
   `src/main.jsx` y los 190 tests de `test/` importen desde una sola ruta
   estable — y esa estabilidad es lo que permitió repartir el código en
   capas sin tocar una línea de `test/`.

   El refactor a arquitectura en capas terminó (ver
   agents/plans/layered-architecture.md): `src/legacy/` ya no existe y
   cada línea de abajo apunta a la feature dueña del símbolo.

   Regla: re-exports explícitos, nunca `export *`. Así, si un símbolo
   quedara declarado en dos módulos a la vez, el error es inmediato en
   vez de silencioso.

   Los grupos van por módulo destino, y el comentario de cada bloque dice
   en qué paso del refactor llegó ahí. */

export { default } from './src/app/App';

/* ── migrado (paso 1) ── */
export { ACCOUNT_SEARCH_THRESHOLD } from './src/shared/design/tokens';

export { uid } from './src/shared/domain/ids';
export { todayIso, monthKey, monthLabel, formatDateLabel } from './src/shared/domain/dates';
export { formatMoney } from './src/shared/domain/money';
export { normalizeForSearch, accountNameMatches } from './src/shared/domain/search';
export { groupByDate } from './src/shared/domain/grouping';

/* Devuelve JSX, así que es `shared/ui` y no dominio. */
export { highlightMatch } from './src/shared/ui/highlight';

export {
  STORAGE_KEY,
  OCR_SETTINGS_STORAGE_KEY,
  openDb,
  loadState,
  saveState,
  loadOcrSettings,
  saveOcrSettings,
} from './src/shared/infrastructure/indexed-db';

/* ── backend Firebase (ver tasks/backend-sync.md): utilidades que
   `test/integration/helpers.jsx` necesita para montar `<App/>` con sesión ya
   resuelta y sin tocar Firestore/IndexedDB de verdad ── */
export { createDeps } from './src/app/dependencies';
export { indexedDbStateRepository } from './src/shared/infrastructure/repositories';
export { fakeAuthGateway } from './src/shared/infrastructure/in-memory';

/* ── migrado (paso 3): feature `accounts` ── */
export {
  computeAccountBalance,
  computeBalances,
  computeTotalBalance,
} from './src/features/accounts/domain/balance';

/* ── migrado (paso 4): feature `transactions` ── */
export { initialFormState } from './src/features/transactions/domain/form';
export {
  computePeriodTransactions,
  computeRecentTxns,
  computeKnownStores,
} from './src/features/transactions/domain/queries';

/* Datos semilla: migrados en el paso 2 porque el store los necesita como
   estado inicial (importarlos del legacy haría ciclo). */
export {
  buildDefaultTransactions,
  buildDefaultInstallmentPlans,
} from './src/shared/domain/defaults';

/* ── migrado (paso 6): feature `dashboard` ── */
export {
  computeTotalIncome,
  computeTotalExpense,
  computeCategoryTotals,
} from './src/features/dashboard/domain/totals';

/* ── migrado (pasos 4 y 5): feature `installments` ── */
export { computePlanProgress } from './src/features/installments/domain/progress';

/* ── migrado (paso 7): feature `history` ── */
export {
  computeHistorySuggestions,
  filterHistoryTransactions,
} from './src/features/history/domain/filters';

/* ── formato de export/respaldo (paso 8; reubicado a shared/ al borrar la
   sincronización manual, ver tasks/backend-sync.md) ── */
export {
  EXPORT_APP_ID,
  EXPORT_SCHEMA,
  EXPORT_TEXT_PREFIX,
  TOMBSTONE_TTL_MS,
  SYNC_COLLECTIONS,
  recordStamp,
  buildExportPayload,
  normalizeExportPayload,
  parseExportText,
} from './src/shared/domain/export-payload';

/* ── migrado (paso 9): feature `backup` ── */
export { replaceDataState } from './src/features/backup/domain/replace';

/* ── migrado (paso 8): compresión y descarga ── */
export {
  supportsCompression,
  gzipString,
  gunzipBytes,
  bytesToBase64,
  base64ToBytes,
} from './src/shared/infrastructure/compression';
export { exportFileName, downloadJson } from './src/shared/infrastructure/download';

/* ── migrado (paso 11): preparar una imagen no sabe nada de Hilo, así que
   —como la compresión y la descarga— vive en `shared/infrastructure/`. ── */
export { fileToBase64, downscaleImage } from './src/shared/infrastructure/image';

/* ── migrado (paso 10): feature `monefy-import` ── */
export {
  parseCsv,
  parseMonefyDate,
  parseMonefyAmount,
  classifyMonefyCategory,
  parseMonefyRows,
} from './src/features/monefy-import/domain/csv';
export { guessAccountType, guessCategoryIcon } from './src/features/monefy-import/domain/guess';
export { parseOscarDescription } from './src/features/monefy-import/domain/oscar';
export { buildMonefyImportPreview } from './src/features/monefy-import/domain/preview';
export { buildMonefyImportPlan } from './src/features/monefy-import/domain/plan';

/* ── migrado (paso 11): feature `receipt-ocr` ── */
export { isValidIsoDate, buildReceiptDraft } from './src/features/receipt-ocr/domain/draft';
export { scanReceipt } from './src/features/receipt-ocr/infrastructure/anthropic';
