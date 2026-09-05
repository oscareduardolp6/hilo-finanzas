/* ------------------------------------------------------------------ */
/* Barrel: API pública de Hilo                                         */
/* ------------------------------------------------------------------ */
/* Este archivo ya no contiene lógica: solo re-exporta. Existe para que
   `src/main.jsx` y los 190 tests de `test/` sigan importando desde una
   sola ruta estable mientras el código se reparte en capas.

   Durante el refactor a arquitectura en capas (ver
   agents/plans/layered-architecture.md) los símbolos van migrando de
   `src/legacy/hilo-legacy.jsx` a su feature. Cuando uno se mueve, se
   cambia SOLO el origen de su línea aquí y los tests no se enteran.

   Regla: re-exports explícitos, nunca `export *`. Así, si un símbolo
   quedara declarado en dos módulos a la vez, el error es inmediato en
   vez de silencioso.

   Los grupos de abajo anticipan el módulo destino de cada símbolo; el
   comentario de cada bloque dice a dónde va cuando le toque migrar. */

export { default } from './src/legacy/hilo-legacy.jsx';

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
  SYNC_STATE_STORAGE_KEY,
  PEER_TTL_MS,
  openDb,
  loadState,
  saveState,
  loadOcrSettings,
  saveOcrSettings,
  makeSyncState,
  loadSyncState,
  saveSyncState,
} from './src/shared/infrastructure/indexed-db';

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

/* ── migrado (paso 8): feature `sync` ── */
export {
  EXPORT_APP_ID,
  EXPORT_SCHEMA,
  EXPORT_TEXT_PREFIX,
  QR_BYTE_LIMIT,
  TOMBSTONE_TTL_MS,
  SYNC_SKEW_MARGIN_MS,
  SYNC_COLLECTIONS,
  recordStamp,
  buildExportPayload,
  normalizeExportPayload,
  parseExportText,
  parseExportBytes,
} from './src/features/sync/domain/payload';
export {
  mergeCollection,
  mergeTombstones,
  mergeDataState,
} from './src/features/sync/domain/merge';

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
