# Plan — Sincronizar escritorio y móvil + respaldo de datos (sin backend)

Implementa la tarea [tasks/desktop-mobile-sync.md](../../tasks/desktop-mobile-sync.md).

**Este plan es una foto de la intención al momento de escribirlo. Si el código diverge, actualiza este archivo en el mismo cambio** — un plan desactualizado engaña a quien lo lea después (regla de `CLAUDE.md`).

---

## Context

Desde la migración a IndexedDB, cada dispositivo guarda su estado local y aislado: lo que se captura en el celular no aparece en la compu y viceversa. La tarea pide una forma de **pasar los datos de un dispositivo a otro sin backend**, como traspaso manual bajo demanda (no sync continua). Un backend real queda para después.

De paso, el usuario quiere poder **hacer archivos de respaldo** de todos sus datos, para guardarlos por si la app falla — no para sincronizar, sino como copia de seguridad, con opción de restaurarlos.

Decisiones confirmadas con el usuario:

1. **Alcance sync:** archivo `.json` + texto comprimido + `navigator.share` en móvil, **+ QR "rápido"** cuando el dataset comprimido cabe en un solo QR; si no cabe, se oculta y quedan archivo/texto.
2. **En el dispositivo receptor (sync):** **merge por `id`**. En conflicto de `id` gana el registro con mayor `updatedAt` (campo nuevo de aquí en adelante; los viejos caen a `createdAt`, y si tampoco hay, gana el entrante).
3. **Borrados:** **con tombstones** — lista de ids borrados con fecha; al combinar, un registro se elimina si su borrado es más reciente que su última edición. Así los borrados viajan entre dispositivos.
4. **Respaldo:** **modal aparte** (`BackupModal`), independiente del de sync. Exporta la foto completa a `.json` y permite **restaurar reemplazando todo** (con confirmación).
5. **Formato de salida:** los tres — descargar `.json`, copiar string comprimido, y `navigator.share` en móvil.

Dependencias npm nuevas (el objetivo es *no depender de un backend*, no escribir todo a mano):
- `qrcode` — genera el QR (segmento binario `byte`).
- `jsqr` — decodifica el QR desde un frame de cámara (`result.binaryData`).

Compresión: `CompressionStream`/`DecompressionStream` gzip nativos. Con feature-check: si el navegador no los tiene, se deshabilita QR y texto comprimido; el `.json` plano sigue funcionando.

---

## Diseño

Todo en el archivo único `hilo-finanzas.jsx`. Se sigue el patrón de `MonefyImportModal`: modales propios abiertos desde `SettingsModal` mediante handlers `onOpenSync` / `onOpenBackup`, renderizados en los dos árboles (móvil y `DesktopShell`).

### 1. Nueva colección de estado: `tombstones`

`tombstones: [{ id, deletedAt }]` — se suma a las 4 colecciones que `App` ya maneja y persiste.

- `App`: `const [tombstones, setTombstones] = useState([])`.
- Hidratación en el efecto de `loadState`: `if (data.tombstones) setTombstones(data.tombstones)`.
- Guardado: incluir `tombstones` en `saveState({ ... })` y en las deps del `useEffect`.
- Handlers de borrado — al eliminar, además de filtrar la lista, `setTombstones(prev => [...prev, { id, deletedAt: Date.now() }])`:
  - `handleDeleteTransaction`, `handleDeleteAccount`, `handleDeletePlan`.
  - `handleResetTransactions`: genera tombstone para cada movimiento borrado.
- Lista plana de ids (los `uid()` son globalmente únicos).
- Poda: en `mergeDataState` se descartan tombstones con `deletedAt` de más de 180 días.

### 2. Helpers puros nuevos (junto a los helpers de importación Monefy)

- `EXPORT_APP_ID = 'hilo-finanzas'`, `EXPORT_SCHEMA = 1`, `QR_BYTE_LIMIT = 2900`, `TOMBSTONE_TTL_MS = 180 * 864e5`.
- `buildExportPayload(state)` → `{ app, schema, exportedAt, data: { accounts, categories, transactions, installmentPlans, tombstones } }`. Mismo formato para sync y respaldo.
- `gzipString(str) → Promise<Uint8Array>` / `gunzipBytes(bytes) → Promise<string>` con `CompressionStream`/`DecompressionStream`. `supportsCompression()` → boolean.
- `bytesToBase64` / `base64ToBytes` (string de portapapeles, prefijo `hilo1:`).
- `parseExportPayload(input)` — acepta objeto, JSON plano, o texto `hilo1:<base64 gzip>`. Valida `app` y arreglos (`tombstones` opcional → `[]`). Lanza `Error` con mensaje claro.
- `recordStamp = r => r.updatedAt ?? r.createdAt ?? 0`.
- `mergeCollection(currentList, incomingList, tombstoneMap)` → `{ list, added, updated, removed }`. Funde por `id` (gana `recordStamp` mayor, empate → entrante), luego elimina registros con `tombstoneMap[id] >= recordStamp(registro)`.
- `mergeDataState(currentState, payload)` → une tombstones (máx `deletedAt`, poda TTL), corre `mergeCollection` sobre las 4 colecciones, devuelve `{ ...5 colecciones, stats: { added, updated, removed } }`.
- `replaceDataState(payload)` → normaliza a las 5 colecciones con defaults. Para restaurar respaldo.

### 3. Sellado de `updatedAt`

`updatedAt: Date.now()` sellado en el handler (sin tocar hijos):
- `handleSaveTransaction` — edición y alta.
- `handleSaveAccount` — ambas ramas.
- `handleSavePlan` — ambas ramas.
- `handleCreateCategory` / `handleCreatePlan` — en el `setState`.
- `handleImportMonefy` — sobre los registros agregados.
- Builders demo/default se dejan (caen a `createdAt`).

### 4. `SyncModal` (nuevo, junto a `MonefyImportModal`)

`SyncModal({ state, onMerge, onClose, desktop })`. `state` = las 5 colecciones.

- `<SheetOverlay onClose={onClose} desktop={desktop}>`, estilos como `SettingsModal`/`MonefyImportModal`.
- Estado: `mode` (`'send' | 'receive'`), `pastedText`, `scanError`, `scanning`, `qrDataUrl`, `payloadBytesLen`, `copied`.
- Al entrar a `send`: `buildExportPayload` → `JSON.stringify` → `gzipString`. Si `len <= QR_BYTE_LIMIT` y `supportsCompression()` → `QRCode.toDataURL([{ data: bytes, mode: 'byte' }], { errorCorrectionLevel: 'L', margin: 2, width: 320 })`; si no → nota "muy grande".
- **Enviar:** bloque QR o nota; **Descargar archivo** (`Blob` + `<a download>`); **Copiar texto** (`hilo1:` + base64); **Compartir** (si `navigator.canShare?.({ files })`).
- **Recibir:** **Escanear QR** (`getUserMedia` + `<video>` + `rAF` + `<canvas>` + `jsQR` → `binaryData` → `gunzipBytes` → `parseExportPayload`); **Subir archivo** (`FileReader.readAsText`); `<textarea>` + **Combinar**. Todo desemboca en `applyIncoming(payload)` → `onMerge(payload)` + `onClose()`. Sin confirmación (merge no destructivo). Resultado por `Toast`.
- Cleanup: `useEffect` return corta tracks de cámara y cancela `rAF`.

### 5. `BackupModal` (nuevo, junto a `SyncModal`)

`BackupModal({ state, onRestore, onClose, desktop })`.

- `<SheetOverlay>`. Texto: "Un respaldo es una copia completa de tus datos… Restaurar **reemplaza todo**…".
- **Respaldar ahora** → descarga `hilo-respaldo-YYYY-MM-DD.json` (`buildExportPayload` + blob). También "Copiar texto".
- **Restaurar desde archivo** → `<input type="file" hidden>` → `parseExportPayload` → guarda payload en estado local + **confirmación inline** (patrón `confirmingReset` de `SettingsModal`) con conteos → `onRestore(payload)` + `onClose()`.
- Sin cámara/QR.

### 6. Cableado en `App`

- Estado: `syncModalOpen`, `backupModalOpen` (`useState(false)`), más `tombstones`.
- `openSyncModal()` / `openBackupModal()` — calcan `openImportModal`.
- `handleMergeSync(payload)` → `mergeDataState(...)` → set de las 5 colecciones → toast `Sincronizado: N nuevos, M actualizados, K borrados`.
- `handleRestoreBackup(payload)` → `replaceDataState(payload)` → set de las 5 colecciones → toast `Respaldo restaurado`.
- El `useEffect` de guardado existente persiste ambos.
- `SettingsModal`: props `onOpenSync`, `onOpenBackup`; botones "Sincronizar dispositivos" y "Respaldo de datos" encima de "Importar desde Monefy". En las dos instancias (móvil + desktop vía `DesktopShell`).
- `DesktopShell`: desestructurar las props nuevas, renderizar `{syncModalOpen && <SyncModal ... desktop />}` y `{backupModalOpen && <BackupModal ... desktop />}` junto al `MonefyImportModal`; pasar `onOpen*` a su `SettingsModal`.
- Árbol móvil: mismos dos bloques junto al `MonefyImportModal`.
- `<DesktopShell .../>` en `App`: agregar props nuevas.

### 7. Iconos

Al import de `lucide-react`: `QrCode`, `Camera`, `Download`, `Upload`, `Copy`, `Share2`, `RefreshCw`, `DatabaseBackup`.

---

## Archivos tocados

- **`hilo-finanzas.jsx`** — colección `tombstones` + helpers export/merge/restore + `SyncModal` + `BackupModal` + sellado `updatedAt` + tombstones en handlers de borrado + cableado en `App`/`DesktopShell`/`SettingsModal` + import de iconos.
- **`package.json`** — deps `qrcode`, `jsqr`.
- **`agents/plans/desktop-mobile-sync.md`** — este plan.
- **`tasks/desktop-mobile-sync.md`** — `status` y sección sobre el respaldo.
- **`tasks/README.md`** — fila de la tabla.
- **`CLAUDE.md`** — `updatedAt` en registros, colección `tombstones`, `saveState`/`loadState` con `tombstones`, `SyncModal`/`BackupModal` en la lista de modales, deps `qrcode`/`jsqr`.
- **`README.md`** — `npm install` tras traer las deps.

---

## Verificación (`npm run dev`, ver README.md)

`npm install` primero. Luego `npm run dev`:

1. **Export archivo (sync):** Ajustes → Sincronizar dispositivos → Enviar → Descargar archivo. `.json` con `app:'hilo-finanzas'`, `schema:1`, `data` con las 5 colecciones (incl. `tombstones: []`).
2. **Export texto:** Copiar texto → empieza con `hilo1:` + base64.
3. **QR según tamaño:** datos demo → QR se renderiza; tras import grande de Monefy → QR desaparece con nota "muy grande".
4. **Idempotencia:** copiar texto → Recibir → pegar → Combinar → toast "0 nuevos, 0 actualizados, 0 borrados", sin duplicados.
5. **Merge real:** exportar; agregar 1 movimiento; reimportar el texto viejo → el movimiento nuevo local se conserva, sin duplicados.
6. **Desempate `updatedAt`:** editar un movimiento; importar payload con ese `id` y `updatedAt` anterior → se conserva la versión local. Al revés → gana el entrante.
7. **Borrado que viaja (tombstone):** exportar estado A; en el receptor borrar un movimiento de A; reimportar A → no reaparece. Recrear ese id con `updatedAt` posterior al `deletedAt` → sobrevive.
8. **Respaldo/restaurar:** Ajustes → Respaldo de datos → Respaldar ahora. Hacer cambios. Restaurar desde archivo → confirmación → estado vuelve a la foto del respaldo.
9. **Escaneo cámara:** escritorio sin cámara → error claro, resto disponible. (Real: móvil contra GitHub Pages o webcam apuntando al QR.)
10. **Ambos layouts:** los dos modales abren y funcionan en móvil (<1024px) y escritorio (≥1024px).
11. **Persistencia:** recargar tras merge y tras restore → datos siguen (IndexedDB), `tombstones` incluido.
12. **Errores:** pegar basura / JSON de otra app → "no parece un export de Hilo", estado intacto.

### Limitaciones
- Tombstones se podan a los 180 días: un dispositivo sin sincronizar más de ese tiempo podría resucitar un registro borrado hace mucho.
- `CompressionStream` ausente → sin QR ni texto comprimido; `.json` plano sigue.
- `getUserMedia` requiere contexto seguro (https o localhost).
