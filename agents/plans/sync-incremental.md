# Plan: Sincronización incremental (delta) entre dispositivos

> Implementa [tasks/sync-incremental.md](../../tasks/sync-incremental.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

`SyncModal` → *Enviar* siempre arma el **payload completo** (`buildExportPayload`, las 5 colecciones enteras) y solo dibuja el QR si el gzip pesa ≤ `QR_BYTE_LIMIT` (2900 bytes). Con un historial grande el QR nunca aparece: quedan archivo y texto. El usuario ya hizo una sincronización "grande" por archivo entre teléfono y compu, y esperaba que a partir de ahí los intercambios diarios (pocos movimientos) cupieran en un QR.

Solución: cada dispositivo guarda **localmente** un `deviceId` y un mapa de *peers* con hasta dónde ha intercambiado datos con cada uno. Con eso *Enviar* puede mandar solo lo creado/editado/borrado desde ese punto — un payload chico que sí cabe en QR.

Decisiones confirmadas con el usuario:

1. **Punto por dispositivo** (id aleatorio + `peers` local), no un único punto global.
2. **Avance del punto:** automático al *recibir* (registra el peer + `lastReceivedAt`); manual para lo que gatilla el delta (`lastSentAt`, botón "marcar como enviado").
3. **Gestión de dispositivos:** tercera pestaña "Dispositivos" en `SyncModal`.
4. Al elegir un peer con punto, el modo **"Solo cambios recientes" viene preseleccionado**.
5. Nombre del dispositivo: **autogenerado y editable** (`Equipo-xxxx`), nunca "sin nombre" localmente.

Por qué es barato: el motor de merge ya soporta payloads parciales sin cambios. `mergeDataState`/`mergeCollection` funden por `id` y **la ausencia de un registro no es un borrado** (los borrados solo viajan como `tombstones`). Un delta es el mismo payload con arrays más cortos. `BackupModal` y el blob `STORAGE_KEY` no cambian de forma; sin migración.

## Diseño

Todo en `hilo-finanzas.jsx` salvo docs.

### 1. Store local `hilo_sync_state_v1` (junto a `loadOcrSettings`/`saveOcrSettings`)

Mismo patrón que OCR settings: clave IndexedDB propia en el store `state`, nunca dentro del blob `STORAGE_KEY`, excluida de sync/QR/respaldo por construcción.

```js
const SYNC_STATE_STORAGE_KEY = 'hilo_sync_state_v1';
const PEER_TTL_MS = 365 * 864e5;

// { deviceId, deviceName, peers: { [peerId]: { name, lastSentAt|null, lastReceivedAt|null } } }
function makeSyncState() {
  const id = uid('dev');
  return { deviceId: id, deviceName: 'Equipo-' + id.slice(-4), peers: {} };
}
async function loadSyncState()  // get(SYNC_STATE_STORAGE_KEY) → obj | null
async function saveSyncState(next)  // poda peers con max(lastSentAt,lastReceivedAt) < now - PEER_TTL_MS, luego put
```

### 2. Constante (junto al bloque `EXPORT_*`)

```js
const SYNC_SKEW_MARGIN_MS = 5 * 60 * 1000; // anti-desfase de reloj entre dispositivos
```

### 3. `buildExportPayload(state, { device, since } = {})`

- Envelope gana `device: device || null`, `partial: Number.isFinite(since)`, `since: Number.isFinite(since) ? since : null`.
- Si `partial`: cada colección de `data` se filtra a `recordStamp(r) > since - SYNC_SKEW_MARGIN_MS`; `tombstones` a `deletedAt > since - SYNC_SKEW_MARGIN_MS`.
- Si no: colecciones completas (comportamiento actual intacto).
- `recordStamp` se sube arriba de `buildExportPayload` por legibilidad.
- Todos los llamadores sin `opts` quedan igual: efecto de envío en `SyncModal`, `handleDownload`/`handleShare`, y `BackupModal` — **el respaldo sigue completo**.

### 4. `normalizeExportPayload(obj)` — tolerar y exponer envelope

Misma validación (`app` + arrays de `SYNC_COLLECTIONS`). Añade al objeto devuelto:

- `exportedAt: obj.exportedAt` (string; puede faltar).
- `device`: si `obj.device` es objeto con `id` string → `{ id, name: typeof obj.device.name === 'string' ? obj.device.name : '' }`, si no `null`.
- `partial: !!obj.partial`, `since: Number.isFinite(obj.since) ? obj.since : null`.

Exports viejos / respaldos sin estos campos → `device:null, partial:false`. `replaceDataState` y `mergeDataState` ignoran los extras. **`mergeDataState` no se toca.**

### 5. `App` — estado y handlers

- `const [syncState, setSyncState] = useState(null)` (info de dispositivo; distinto del *bundle* de 5 colecciones).
- Bootstrap en el efecto de montaje, cadena aparte como `loadOcrSettings`:
  `loadSyncState().then(s => setSyncState(s && s.deviceId ? { peers: {}, ...s } : makeSyncState())).catch(() => setSyncState(makeSyncState()))`.
- Persistir: `useEffect(() => { if (syncState) saveSyncState(syncState).catch(() => {}); }, [syncState])` — cubre también el primer guardado del `deviceId` al montar.
- `handleRenameDevice(name)` → `setSyncState(s => ({ ...s, deviceName: name.trim() || s.deviceName }))`.
- `handleResetPeer(peerId)` → borra `peers[peerId]`.
- `handleMarkSent(peerId, at)` → upsert `peers[peerId].lastSentAt = at` (conserva `name`/`lastReceivedAt`); toast `Punto marcado con <name>`.
- `handleMergeSync(incoming)` — tras setear las 5 colecciones, si `incoming.device?.id && incoming.device.id !== syncState.deviceId`:
  `at = Date.parse(incoming.exportedAt) || Date.now()`; upsert
  `peers[incoming.device.id] = { name: incoming.device.name || prev?.name || '', lastReceivedAt: at, lastSentAt: prev?.lastSentAt ?? null }`.
  Toast: `Sincronizado con <name>: N nuevos, M actualizados, K borrados` + ` (parcial)` si `incoming.partial`; sin `device` cae al texto actual.

### 6. `SyncModal` — tercera pestaña + envío delta

Props nuevas: `syncState`, `onRenameDevice`, `onResetPeer`, `onMarkSent`. Interno: `const sync = syncState || { deviceId:'', deviceName:'', peers:{} }`.

- `mode` ahora `'send' | 'receive' | 'devices'`; el tab-bar mapea 3 entradas.
- **Enviar:**
  - Estado local: `peerId` (un `useEffect` keyed en el conjunto de ids lo pone en el peer con mayor `max(lastSentAt,lastReceivedAt)`, si no `''`); `sendAll` (`useState(false)`).
  - `canDelta = !!(selectedPeer && selectedPeer.lastSentAt)`; `deltaSince = canDelta && !sendAll ? selectedPeer.lastSentAt : undefined`. Sin `canDelta` el envío es completo aunque `sendAll` sea `false` (el toggle ni se muestra), así "Solo cambios recientes" queda preseleccionado en cuanto el peer tiene punto.
  - Selector "Enviar a": opciones de `sync.peers` + `''` = "Otro / primera vez". Oculto si no hay peers. Al cambiar de peer, `setSendAll(false)`.
  - Toggle "Solo cambios recientes" / "Todo" — visible solo si `canDelta`.
  - Efecto de preparación (deps `[mode, state, deltaSince, sync.deviceId, sync.deviceName]`):
    `device = sync.deviceId ? { id: sync.deviceId, name: sync.deviceName } : undefined`;
    `payload = buildExportPayload(state, { device, since: deltaSince })`; cuenta de registros del payload → "N registros"; gzip → QR igual que hoy.
  - Bajo el QR, si hay delta activo: línea "Solo lo nuevo desde <fecha> · N registros".
  - Botón **"Marcar como enviado a <name>"** (solo con peer real) → confirmación inline estilo `confirmingReset` → `onMarkSent(peerId, Date.parse(payload.exportedAt) || Date.now())`. El efecto re-corre y el delta baja a ~0.
- **Recibir:** sin cambios (el upsert de peer lo hace `handleMergeSync`).
- **Dispositivos:**
  - Input "Nombre de este dispositivo" seed `sync.deviceName`, guarda en blur/botón → `onRenameDevice`.
  - Lista de peers: nombre (o "Dispositivo sin nombre"), "Enviado hasta: <fecha|nunca>", "Recibido hasta: <fecha|nunca>", botón "Reiniciar punto" → confirm → `onResetPeer(id)`.
  - Vacío: "Aún no has recibido de otro dispositivo."
- Iconos: `Smartphone`, `Check`, `Trash2`, `RefreshCw` ya están importados — no hacen falta iconos nuevos.

### 7. Cableado en los dos árboles

- **Móvil**: pasar `syncState` + los 3 handlers a `<SyncModal>`.
- **`DesktopShell`**: el prop actual `syncState` es el *bundle* de 5 colecciones → renombrarlo a **`syncData`** (destructuring, `state={syncData}` en `SyncModal` y `BackupModal`, y el `syncState={{...}}` que lo alimenta desde `App`). Añadir el prop nuevo `syncState={syncState}` (info de dispositivo) + los 3 handlers al destructuring de `DesktopShell` y a su `<SyncModal>`.
- `<DesktopShell .../>` en `App`: añadir `syncState={syncState}` y los 3 handlers junto a `syncData={{...}}`.

## Archivos tocados

- `hilo-finanzas.jsx` — store `hilo_sync_state_v1` + helpers; `SYNC_SKEW_MARGIN_MS`; `buildExportPayload(state, {device, since})`; `normalizeExportPayload` tolerante; estado/handlers `syncState` en `App`; 3ª pestaña + envío delta + "marcar como enviado" en `SyncModal`; rename `syncState`→`syncData` y props nuevas en `DesktopShell`.
- `agents/plans/sync-incremental.md` — este plan.
- `tasks/sync-incremental.md` — `status`.
- `tasks/README.md` — fila de la tabla.
- `CLAUDE.md` — store local `SYNC_STATE_STORAGE_KEY`, `buildExportPayload` con `{device, since}` y deltas `partial`, 3ª pestaña "Dispositivos".

## Verificación (`npm run dev`, ver README.md; IndexedDB sí persiste en dev)

1. **Bootstrap:** primera carga → Ajustes → Sincronizar dispositivos → pestaña "Dispositivos": nombre autogenerado `Equipo-xxxx`. Renombrar, recargar → persiste (DevTools → IndexedDB `hilo_finanzas` → `state` → `hilo_sync_state_v1`).
2. **Envío sin peers:** pestaña Enviar → solo "Todo"; con datos demo el QR se dibuja. El `.json` descargado trae `device:{id,name}`, `partial:false`, `since:null`.
3. **Alta de peer:** en un segundo perfil/incógnito, abrir la app y *Recibir* el export completo del primero (archivo o texto). Toast "Sincronizado con Equipo-xxxx…". Su pestaña Dispositivos lista el peer con "Recibido hasta: hoy".
4. **Delta:** en el receptor agregar 2 movimientos → Enviar → elegir el peer → "Solo cambios recientes" preseleccionado → muestra "2 registros" + QR chico. Descargar/copiar.
5. **Merge del delta:** en el primer dispositivo *Recibir* ese delta → "2 nuevos", nada más tocado, sin duplicados; toast con "(parcial)".
6. **Idempotencia:** recibir el mismo delta otra vez → "0 nuevos, 0 actualizados, 0 borrados".
7. **Marcar como enviado:** en el receptor, tras generar el delta, "Marcar como enviado a <peer>" → confirmar → el efecto re-corre → "0 registros". Recargar → `lastSentAt` persiste.
8. **Margen anti-desfase:** editar un movimiento y, por DevTools, poner su `updatedAt` justo por debajo del `lastSentAt` del peer pero por encima de `lastSentAt - 5min` → sigue entrando en el delta.
9. **Reiniciar punto:** Dispositivos → "Reiniciar punto" en el peer → el próximo Enviar vuelve a "Todo" por defecto.
10. **Respaldo intacto:** BackupModal → Respaldar ahora → JSON completo, `partial:false`; restaurar sigue reemplazando.
11. **Ambos layouts:** móvil (<1024px) y escritorio (≥1024px) — las 3 pestañas abren y funcionan.
12. **Retrocompat:** *Recibir* un export viejo (sin `device`/`partial`) → funde bien, no agrega peer, sin errores.

### Limitaciones

- El delta confía en `lastSentAt`: marcar el punto sin que el peer tuviera todo lo anterior → esos registros viejos no vuelven a viajar por QR. La sincronización completa es la vía de recuperación.
- Un import de Monefy / escaneo masivo después del punto entra al delta y puede reventar el presupuesto del QR → cae a archivo (esperado).
- Los `peers` se podan a los 365 días sin intercambio.
