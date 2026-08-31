---
status: implementada
priority: 5
---

# Sincronización incremental (delta) entre dispositivos

Continuación de [desktop-mobile-sync.md](desktop-mobile-sync.md).

## Problema

`SyncModal` siempre arma el **payload completo** (las 5 colecciones enteras) y solo
dibuja el QR si el gzip pesa ≤ `QR_BYTE_LIMIT` (2900 bytes). Con un historial grande
eso nunca se cumple: el QR queda permanentemente inservible y solo funcionan archivo
o texto.

El flujo real del usuario es:

1. Una sincronización "grande" por archivo (teléfono → archivo → compu), una sola vez,
   para que ambos dispositivos compartan todo el historial.
2. A partir de ahí, cada día se agregan pocos movimientos en cada dispositivo. La
   expectativa era poder pasar **solo ese puñado nuevo** con un QR.

## Idea: "punto de sincronización" por dispositivo

Cada dispositivo guarda, **localmente y fuera del blob sincronizado**, un registro de
hasta dónde ha intercambiado datos con cada otro dispositivo. Con eso, *Enviar* puede
mandar únicamente lo creado / editado / borrado desde ese punto — un payload chico que
normalmente **sí cabe en un QR**.

### Claves de por qué esto es barato

- **El motor de merge ya soporta payloads parciales sin cambios.** `mergeDataState`
  funde `mergeCollection` **por `id`**; un registro ausente **no** se interpreta como
  borrado (los borrados solo viajan como `tombstones`). Un "delta" es literalmente el
  mismo payload con menos registros adentro. `mergeCollection` / `mergeTombstones` /
  el TTL de tombstones **no se tocan**.
- **`BackupModal` no cambia.** Los respaldos siguen siendo completos, nunca parciales.
  `replaceDataState` ignora los campos nuevos del envelope.
- **El blob `STORAGE_KEY` no cambia de forma.** Sin migración, sin bump de `_v1`.

## Modelo

### Identidad de dispositivo

En la primera carga, cada dispositivo genera un `deviceId` aleatorio (`uid()` /
`crypto.randomUUID()`). Se guarda en una **clave IndexedDB propia y local**, al estilo
de `OCR_SETTINGS_STORAGE_KEY` (p. ej. `SYNC_STATE_STORAGE_KEY = 'hilo_sync_state_v1'`).
Nunca entra a sync / QR / respaldo, por construcción.

```jsonc
// hilo_sync_state_v1  (local, por dispositivo)
{
  "deviceId": "d_9f3a…",          // aleatorio, una vez
  "deviceName": "Teléfono",        // editable por el usuario, opcional
  "peers": {
    "d_1b77…": {                   // otro dispositivo visto al recibir
      "name": "Compu",             // autoreportado por el peer, sobreescribible local
      "lastSentAt":     1710000000000,  // hasta aquí YO le he mandado mis datos
      "lastReceivedAt": 1710500000000   // hasta aquí YO he incorporado los suyos
    }
  }
}
```

Tolerar ausencia total → hidratar a `{ deviceId: <nuevo>, deviceName: '', peers: {} }`.
Podar peers no vistos en ~365 días al guardar.

### Dos relojes distintos por peer

- **`lastSentAt`** — gobierna qué lleva el **próximo delta que YO le envío**.
  Avanza **manualmente**, con un botón *"Marcar como enviado a <peer>"* después de
  mostrar el QR/archivo (con confirmación: "¿El otro dispositivo ya lo escaneó/importó?").
  Se fija al `exportedAt` del payload que se acaba de generar, para que el siguiente
  delta empiece exactamente donde terminó éste.
- **`lastReceivedAt`** — informativo (UI: "última vez que recibiste de <peer>").
  Avanza **automáticamente** al *Recibir* un payload de ese peer con éxito: se fija al
  `exportedAt` del payload entrante y se hace upsert del peer (id + nombre autoreportado).

Recibir **no** mueve `lastSentAt`: recibir no prueba nada sobre lo que el peer tiene de
lo mío.

### Envelope del payload

Todo payload (completo o delta) pasa a llevar:

```jsonc
{
  "app": "hilo-finanzas",
  "schema": 1,
  "exportedAt": "…ISO…",
  "device": { "id": "d_9f3a…", "name": "Teléfono" },  // NUEVO — quién lo produjo
  "partial": false,                                    // NUEVO
  "since": null,                                       // NUEVO — epoch si partial
  "data": { /* 5 colecciones */ }
}
```

`normalizeExportPayload` debe tolerar `device` / `partial` / `since` **ausentes**
(exports viejos, respaldos): sin `device` → "peer desconocido", solo se puede mandar
completo, y al recibir no se registra peer.

### Cálculo del delta

Con `MARGIN = 5 min` (anti-desfase de reloj; los timestamps son `Date.now()` de cada
dispositivo):

- `cutoff = peers[p].lastSentAt - MARGIN`
- `data.<colección>` = registros con `recordStamp(r) > cutoff`
- `data.tombstones` = tombstones con `deletedAt > cutoff`
- `partial: true`, `since: peers[p].lastSentAt`

Reenviar algún registro de borde por el margen es inofensivo: el merge es idempotente.

## UX (`SyncModal`)

### Enviar

1. Si hay ≥1 peer conocido: selector *"Enviar a: [Compu ▾]"* + opción *"Otro / primera vez"*.
2. Peer con `lastSentAt` → toggle *"Solo cambios desde <fecha> (N registros)"* vs *"Todo"*.
   Sin peer / sin `lastSentAt` → siempre "Todo" (comportamiento actual, sin regresión).
3. Se arma el payload (delta o completo), se regenera QR/texto/archivo igual que hoy.
   Si el delta aún no cabe en QR (día pesado, import de Monefy) → mismo aviso "muy
   grande" → archivo/texto. El delta mejora la probabilidad, no la garantiza.
4. Botón *"Marcar como enviado a <peer>"* → confirma y fija `peers[p].lastSentAt`.

### Recibir

Tras un merge exitoso, si `payload.device` viene: upsert
`peers[id] = { name, lastReceivedAt: payload.exportedAt }`. Toast:
"Sincronizado con <peer>: N nuevos, M actualizados" + "(actualización parcial)" si
`partial`.

### Dispositivos

Panel compacto (tercera pestaña de `SyncModal` o sección en `SettingsModal`, decidir en
el plan): renombrar este dispositivo, listar peers con fechas de último envío/recepción,
y *"Reiniciar punto"* por peer (borra sus relojes → vuelve a mandarle todo). "Enviar
todo" siempre disponible como vía de recuperación si dos dispositivos divergen.

## Riesgo principal a documentar

El delta **confía** en `lastSentAt`. Si se marca el punto sin que el peer realmente
tuviera todo lo anterior, esos registros viejos **nunca** llegan por QR. Disciplina:
marcar el punto solo tras una sincronización completa confirmada. La sincronización
completa es siempre la vía de recuperación.

Casos menores: un import de Monefy / escaneo masivo después del punto entra al delta y
puede reventar el presupuesto del QR → cae a archivo (ok). Registros sin `updatedAt`
con `createdAt` viejo quedan correctamente fuera de cualquier delta — que es justo la
suposición "eso ya está en el otro dispositivo".

## Archivos tocados

- **`hilo-finanzas.jsx`** — `SYNC_STATE_STORAGE_KEY` + `loadSyncState`/`saveSyncState`/
  `makeSyncState`; `SYNC_SKEW_MARGIN_MS`; `buildExportPayload(state, { device, since })`;
  `normalizeExportPayload` tolerante; estado/handlers `syncState` en `App`
  (`handleRenameDevice`/`handleResetPeer`/`handleMarkSent`, upsert de peer en
  `handleMergeSync`); selector de peer + toggle todo/delta + botón "marcar como enviado"
  + pestaña "Dispositivos" en `SyncModal`; rename `syncState`→`syncData` en `DesktopShell`.
- **`agents/plans/sync-incremental.md`** — plan.
- **`tasks/README.md`** — fila de la tabla.
- **`CLAUDE.md`** — store local `SYNC_STATE_STORAGE_KEY`, `buildExportPayload` con
  `{ device, since }` y deltas `partial`, 3ª pestaña "Dispositivos", nota de que el merge
  ya soportaba payloads parciales.

## Decisiones ya tomadas con el usuario

- **Avance del punto:** automático al *recibir* (nombre/peer + `lastReceivedAt`);
  manual para lo que gatilla el delta (`lastSentAt`).
- **Alcance:** punto **por dispositivo** (id aleatorio + `peers` local), no un único
  punto global.
- **UI:** tercera pestaña "Dispositivos" en `SyncModal`; nombre de equipo autogenerado
  (`Equipo-xxxx`) y editable; al elegir un peer con punto, "Solo cambios recientes"
  viene preseleccionado.

## Cómo quedó (implementada)

Ver [agents/plans/sync-incremental.md](../agents/plans/sync-incremental.md) para el detalle. En resumen:

- **Store local `hilo_sync_state_v1`** (`SYNC_STATE_STORAGE_KEY`, junto a la config de
  OCR): `{ deviceId, deviceName, peers: { [id]: { name, lastSentAt, lastReceivedAt } } }`.
  Fuera del blob `STORAGE_KEY` → nunca viaja en sync/QR/respaldo. `App` lo bootea con
  `makeSyncState()` y lo persiste con un `useEffect` sobre `saveSyncState` (poda peers
  inactivos > 365 días).
- **`buildExportPayload(state, { device, since })`**: con `since` filtra cada colección
  a `recordStamp(r) > since - SYNC_SKEW_MARGIN_MS` (5 min de margen anti-desfase) y
  marca `partial: true`. El envelope siempre lleva `device`, `partial`, `since`.
- **El merge no cambió.** `mergeDataState` funde un payload parcial por `id` igual que
  uno completo (ausencia ≠ borrado). `normalizeExportPayload` expone
  `exportedAt`/`device`/`partial`/`since` y los trata como opcionales (exports viejos y
  respaldos siguen entrando sin peer ni cambios de comportamiento).
- **`SyncModal`** ahora tiene 3 pestañas. *Enviar*: selector "Enviar a" (peers + "Otro /
  primera vez"), toggle "Solo cambios recientes" / "Todo" (solo si el peer tiene
  `lastSentAt`), línea "Solo lo nuevo desde <fecha> · N registros", y botón "Marcar como
  enviado a <peer>" con confirmación inline que fija `lastSentAt` al `exportedAt` del
  payload mostrado. *Dispositivos*: renombrar este equipo, lista de peers con "Enviado /
  Recibido hasta", y "Reiniciar punto" por peer.
- **`handleMergeSync`**: al recibir de un peer conocido hace upsert de
  `peers[id].lastReceivedAt = Date.parse(exportedAt)` (+ nombre autoreportado) y el toast
  dice "Sincronizado con <peer>: … (parcial)". No toca `lastSentAt`.
- Cableado en los dos árboles: el prop de `DesktopShell` que llevaba el bundle de 5
  colecciones se renombró `syncState` → `syncData` para dejar libre `syncState` (info de
  dispositivo).

### Limitación principal

El delta confía en `lastSentAt`: si se marca el punto sin que el peer tuviera de verdad
todo lo anterior, esos registros viejos no vuelven a viajar por QR. La sincronización
completa ("Todo", o "Reiniciar punto") es la vía de recuperación.
