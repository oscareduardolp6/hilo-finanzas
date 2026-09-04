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

/* → src/features/accounts/ */
export {
  computeAccountBalance,
  computeBalances,
  computeTotalBalance,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/transactions/ */
export {
  initialFormState,
  computePeriodTransactions,
  computeRecentTxns,
  computeKnownStores,
} from './src/legacy/hilo-legacy.jsx';

/* Datos semilla: migrados en el paso 2 porque el store los necesita como
   estado inicial (importarlos del legacy haría ciclo). */
export {
  buildDefaultTransactions,
  buildDefaultInstallmentPlans,
} from './src/shared/domain/defaults';

/* → src/features/dashboard/ */
export {
  computeTotalIncome,
  computeTotalExpense,
  computeCategoryTotals,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/installments/ */
export {
  computePlanProgress,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/history/ */
export {
  computeHistorySuggestions,
  filterHistoryTransactions,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/sync/ */
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
  mergeCollection,
  mergeTombstones,
  mergeDataState,
  replaceDataState,
} from './src/legacy/hilo-legacy.jsx';

/* → src/shared/infrastructure/ (compresión, descarga, archivos) */
export {
  supportsCompression,
  gzipString,
  gunzipBytes,
  bytesToBase64,
  base64ToBytes,
  exportFileName,
  downloadJson,
  fileToBase64,
  downscaleImage,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/monefy-import/ */
export {
  parseCsv,
  parseMonefyDate,
  parseMonefyAmount,
  classifyMonefyCategory,
  parseMonefyRows,
  guessAccountType,
  guessCategoryIcon,
  parseOscarDescription,
  buildMonefyImportPreview,
  buildMonefyImportPlan,
} from './src/legacy/hilo-legacy.jsx';

/* → src/features/receipt-ocr/ */
export {
  isValidIsoDate,
  buildReceiptDraft,
  scanReceipt,
} from './src/legacy/hilo-legacy.jsx';
