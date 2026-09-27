# Plan — Sincronización automática con backend (Firebase)

Implementa [tasks/backend-sync.md](../../tasks/backend-sync.md).

**Este plan es una foto de la intención al momento de escribirlo. Si el código diverge, actualiza este archivo en el mismo cambio** — un plan desactualizado engaña a quien lo lea después (regla de `CLAUDE.md`).

---

## Context

Hoy Hilo guarda todo en IndexedDB, por dispositivo, y la única forma de llevar datos de uno a otro es manual: `SyncModal` (QR / texto / archivo, con deltas incrementales por "punto de sincronización") y `BackupModal` (export/restore completo). Ambas tareas predecesoras ([desktop-mobile-sync.md](../../tasks/desktop-mobile-sync.md), [sync-incremental.md](../../tasks/sync-incremental.md)) ya dejaban anotado que esto era un parche hasta tener sincronización automática de verdad.

Decisiones confirmadas con el usuario (ver [tasks/backend-sync.md](../../tasks/backend-sync.md)):

1. **Firebase**: Firestore (datos) + Firebase Auth con Google Sign-In (login), por ser lo más rápido/barato/seguro para un solo usuario con la app desplegada públicamente.
2. **Login bloqueante**, sesión persistida por el propio SDK, botón "Cerrar sesión" en Ajustes. **Cómo quedó el método, distinto de lo planeado:** el plan original decía `signInWithRedirect` siempre (pensando en la PWA); probado en vivo (navegador normal, no la PWA instalada) el redirect se queda pegado en la pantalla de login **sin ningún error** — el selector de cuenta de Google se abre y se elige bien, pero el regreso a la app nunca trae usuario. Causa: `signInWithRedirect` depende de un viaje ida-vuelta por `authDomain` que usa storage de terceros para reconectar el resultado con el origen de la app, y Chrome lo bloquea cada vez más agresivamente (third-party storage partitioning) — rompe el login en silencio. Se cambió a **`signInWithPopup` como default** (no depende de storage de terceros, habla directo con `window.opener`) y `signInWithRedirect` se conserva solo para cuando la app corre en modo standalone (PWA instalada), detectado con `matchMedia('(display-mode: standalone)')` — ahí sí el popup es el que falla. Ver `src/shared/infrastructure/auth.ts`.
3. **Modelo de datos por usuario desde el día uno** (`users/{uid}`), aunque hoy solo exista un usuario — así abrir la app a más gente después es solo cambiar la regla de seguridad.
4. **Un solo documento Firestore** por usuario con el blob completo (no subcolecciones) — más rápido de implementar. El margen de 1 MiB resultó MÁS AJUSTADO de lo previsto: el primer restore de un respaldo real (años de historial) lo rebasó (2.98 MB sin comprimir) — ver "Ajuste post-lanzamiento" más abajo, se resolvió comprimiendo el blob con gzip antes de escribirlo, sin tocar el puerto ni migrar a subcolecciones.
5. **Se elimina `SyncModal`** (QR, texto comprimido, deltas, peers). **Se mantiene `BackupModal`** tal cual (export/restore manual, útil independientemente del backend).
6. Sin listener en tiempo real (`onSnapshot`) en esta primera versión — se lee al hidratar y se guarda en cada cambio, igual que hoy con IndexedDB. Justificación: es la forma más simple de implementar y ya resuelve el problema real ("no más QR/archivos a mano"); ver un cambio de otro dispositivo sin recargar queda para después.

### Migración de datos existentes: el teléfono es la fuente de la verdad

El usuario tiene datos en dos dispositivos (teléfono y compu) pero confirmó que **el teléfono es la fuente de la verdad** y no le importa perder lo que solo exista en el otro dispositivo. Con eso, la migración inicial puede ser la versión simple: al iniciar sesión, si Firestore está vacío, sube el blob local de ese dispositivo; si Firestore ya tiene datos, no se toca — gana lo que ya está en la nube.

**Consecuencia práctica de orden de operaciones (no la impone el código, es disciplina del usuario):** hay que iniciar sesión **primero en el teléfono**, para que sea su blob el que siembra Firestore. Si se inicia sesión antes en otro dispositivo, ese sería el que queda como fuente de la verdad en la nube, y los datos del teléfono no subirían solos después (Firestore ya no estaría vacío). Esto se documenta en la Verificación, como instrucción a seguir, no como algo que valga la pena resolver en código dado que el propio usuario aceptó el riesgo.

Con esta simplificación, **no hace falta rescatar `merge.ts`** — se borra junto con el resto de `sync/` (`mergeDataState`/`mergeCollection`/`mergeTombstones` no se usan en ningún otro lado). Solo `payload.ts` sigue necesitando reubicarse, porque `backup/` sí depende de él (ver punto 1). Lo que se borra: `peers.ts`, `prepare-share.ts`, `receive-sync.ts`, `sync-slice.ts`, `SyncModal`/`SyncContainer`, el `QrGateway`, `SyncStateRepository`, y ahora también `merge.ts`.

---

## Diseño

### 1. Reubicar lo que `backup/` toma prestado de `sync/` antes de borrar `sync/`

Investigación confirmó (ver inventario abajo) que `backup/application/build-backup.ts` y `read-backup.ts` importan `buildExportPayload`/`parseExportText`/`EXPORT_TEXT_PREFIX`/`ExportPayload`/`IncomingPayload` desde `src/features/sync/domain/payload.ts` — una reubicación física dentro de la carpeta de otra feature, que ya rompía la regla de capas de `CLAUDE.md` (una feature nunca debería alcanzar el código de otra) independientemente de este cambio.

- **`src/features/sync/domain/payload.ts` → `src/shared/domain/export-payload.ts`**. **Cómo quedó, distinto de lo planeado:** en vez de moverlo tal cual, se podó al escribirlo — `QR_BYTE_LIMIT`, `SYNC_SKEW_MARGIN_MS`, `parseExportBytes` y `countPayloadRecords` (y la rama `since`/delta de `buildExportPayload`) no se copiaron, porque backup no los usa y quedar sin uso era peor que no tenerlos. `SYNC_COLLECTIONS`/`OPTIONAL_SYNC_COLLECTIONS`/`recordStamp`/`EXPORT_APP_ID`/`EXPORT_SCHEMA`/`EXPORT_TEXT_PREFIX`/`TOMBSTONE_TTL_MS`/`buildExportPayload`/`normalizeExportPayload`/`parseExportText` sí se conservaron (confirmado por lectura directa de `build-backup.ts`/`read-backup.ts`/sus tests antes de borrar nada).
- Actualizados los imports en `backup/application/{build-backup,read-backup}.ts` y sus `.test.ts` a la nueva ruta.
- `merge.ts` no se reubica — se borra junto con el resto de `sync/` (ver "Migración de datos existentes" arriba).

### 2. `AuthGateway`: puerto + implementación real + doble en memoria

Mismo patrón que `QrGateway`/`ClipboardGateway` (puerto en `shared/domain/ports.ts`, implementación en `shared/infrastructure/`, sin necesidad de que viva dentro de una feature — precedente confirmado: `QrGateway` vivía en `shared/` aunque solo lo usaba `sync/`).

`src/shared/domain/ports.ts` — nuevo puerto:
```ts
export type AuthUser = { uid: string; email: string | null; displayName: string | null };
export type AuthGateway = {
  readonly signInWithGoogle: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Devuelve la función para desuscribirse. */
  readonly onAuthStateChanged: (cb: (user: AuthUser | null) => void) => () => void;
};
```

`src/shared/infrastructure/firebase.ts` (nuevo) — inicialización del SDK, config vía env de Vite. **Cómo quedó, distinto de lo planeado:** `auth`/`db` **no son consts eager** sino funciones (`auth(): Auth`, `db(): Firestore`) que inicializan perezosamente en la primera llamada. Motivo, descubierto durante la implementación: con consts eager, `getAuth()` corre al importar `firebase.ts` — y como `dependencies.ts` lo importa transitivamente, **cada uno de los ~46 archivos de test** (cada uno con su propio grafo de módulos, `isolate: true`) pagaba el costo de inicializar el SDK completo, aunque ningún test real lo usara (todo se sobreescribe por dobles en memoria). Eso desestabilizó la suite bajo ejecución paralela (timeouts intermitentes). Con getters perezosos, el SDK solo se inicializa si algo de verdad llama `auth()`/`db()` — que en test nunca pasa.

`src/shared/infrastructure/auth.ts` (nuevo) — `browserAuthGateway: AuthGateway`, con `signInWithGoogle` bifurcado: `signInWithPopup(auth(), googleProvider)` en el navegador normal, `signInWithRedirect(auth(), googleProvider)` solo en PWA standalone (ver "Cómo quedó" arriba). `firebaseSignOut(auth())`, `onAuthStateChanged(auth(), cb)` mapeado al tipo `AuthUser` angosto de Hilo. `getRedirectResult(auth())` también se hizo perezoso — se dispara en el primer `onAuthStateChanged` real (guardado con un flag), no al importar el módulo, por la misma razón de arriba.

`src/shared/infrastructure/in-memory.ts` — `fakeAuthGateway(log, initialUser?: AuthUser | null)`, mismo estilo "capability-fake" que `fakeClipboardGateway`/`fakeShareGateway` (no el patrón `makeRepository`, porque signIn/signOut son imperativos, no load/save).

### 3. `firestoreStateRepository`: nueva implementación de `StateRepository`

Reutiliza el helper `attempt` (`TE.tryCatch` + `persistenceError`) que ya existe en `shared/infrastructure/repositories.ts`. Un documento por usuario en la colección `users`, id = `uid`, con el blob `DataState` completo como cuerpo del documento — mismo shape que `loadState()`/`saveState()` ya usan hoy contra IndexedDB, solo cambia el destino:

```ts
export const firestoreStateRepository: StateRepository = {
  load: attempt<DataState | null>(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db(), 'users', uid));
    return snap.exists() ? (snap.data() as DataState) : null;
  }),
  save: (state) => attempt<void>(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) throw new Error('No hay sesión activa');
    await setDoc(doc(db(), 'users', uid), state);
  }),
};
```
(`auth`/`db` como funciones, no consts — ver la nota de arriba sobre lazy init.)

`indexedDbStateRepository` **no se borra** — sigue existiendo en `repositories.ts` tal cual, solo deja de ser lo que `productionDeps.stateRepository` usa. Lo sigue usando directamente el paso de migración (punto 4).

### 4. Migración/merge inicial, una vez por dispositivo al iniciar sesión

Nuevo `src/app/application/migrate-to-firestore.ts`, en el mismo nivel que `hydrate.ts` (bootstrap de composition root, no una feature). Es la única otra excepción documentada a "solo un slice llama `runRTE`" — la misma excepción que ya aplica a `hydrate` en `store-context.tsx`, porque esto corre *antes* de que el store exista.

Lógica (simple, dado que el usuario confirmó que no necesita proteger al segundo dispositivo): leer `firestoreStateRepository.load()` (remoto) e `indexedDbStateRepository.load()` (local de este dispositivo, import directo, sin pasar por `Deps.stateRepository`) en paralelo.

- Remoto `null`, local con datos → `firestoreStateRepository.save(local)` (siembra Firestore con el blob de este dispositivo).
- Remoto `null`, local `null` → nada que hacer.
- **Remoto con datos (venga de este dispositivo u otro) → no se toca.** Gana lo que ya está en Firestore; el local de este dispositivo se ignora a partir de aquí. Es intencional: el usuario ya asumió ese riesgo porque el teléfono es su fuente de la verdad y debe ser el primero en iniciar sesión.

Se corre en cada login (barato: dos lecturas), sin flag local de "ya migré" — una vez que Firestore tiene datos, esta función es un no-op el resto de las veces.

### 5. `AuthGate`: el login bloqueante, fuera del store

**No es un slice de Zustand.** Razón: `HiloStoreProvider` crea el store con `productionDeps` de forma estática al montar — pero `firestoreStateRepository.load/save` ya resuelven el `uid` internamente vía `auth.currentUser` (punto 3), así que `Deps` **no** necesita reconstruirse por `uid` como se especuló en la conversación previa. Eso simplifica todo: `dependencies.ts` casi no cambia de forma (solo qué repositorio concreto usa, más el gateway nuevo), y el login puede vivir como una capa por *completo* separada, arriba de `HiloStoreProvider`, con su propio React Context — igual que `HiloStoreContext` es su propio contexto separado hoy.

`src/app/auth-context.tsx` (nuevo): `AuthContext` con `{ user: AuthUser | null; signOut: () => void }`, y `AuthGate({ children })`:
- Estado local `status: 'resolving' | 'loggedOut' | 'migrating' | 'ready'`.
- `useEffect` al montar: `authGateway.onAuthStateChanged(async (user) => { ... })` — sin usuario → `loggedOut`; con usuario → `migrating`, corre `migrate-to-firestore`, luego `ready`.
- `status === 'resolving' | 'migrating'` → mismo placeholder "Cargando…" que ya usa `App.tsx` hoy (reutilizar, no duplicar el marcado).
- `status === 'loggedOut'` → `LoginScreen` (nuevo componente en `src/app/ui/LoginScreen.tsx`): un botón "Iniciar sesión con Google", estilos consistentes con `COLORS`/Tailwind del resto de la app.
- `status === 'ready'` → `<AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>`.

`src/app/App.tsx`: el export por defecto pasa a ser `<AuthGate><HiloStoreProvider><AppBody/></HiloStoreProvider></AuthGate>`. `AppBody` no cambia.

`src/features/settings/ui/containers/SettingsContainer.tsx`: agrega `const { signOut } = useContext(AuthContext)`, pasa `onSignOut={signOut}` a `SettingsModal`. Es la única lectura fuera del store Zustand en toda la UI de features — vale la pena dejarlo anotado en el propio código, ya que es una excepción deliberada al patrón "todo pasa por el store", justificada porque la sesión vive estructuralmente por encima del store (no puede vivir dentro de algo que ella misma condiciona si existe).

### 6. Borrar `sync/` (UI y flujo manual), mantener `backup/` intacto

Inventario confirmado por la exploración — **se borra**:
- `src/features/sync/` completo (`domain/merge.ts`, `domain/peers.ts` + su test, `application/prepare-share.ts`, `application/receive-sync.ts` + su test, `store/sync-slice.ts`, `ui/components/SyncModal.tsx`, `ui/containers/SyncContainer.tsx`, `ui/sync.test.tsx`) — ya sin `domain/payload.ts`, reubicado en el paso 1.
- `src/shared/infrastructure/qr.ts` (`QrGateway`/`browserQrGateway`).
- Puerto `QrGateway` en `ports.ts`; `SyncStateRepository` (puerto + `indexedDbSyncStateRepository` + `inMemorySyncStateRepository` + `fakeQrGateway`) en `repositories.ts`/`in-memory.ts`.
- `makeSyncState`/`loadSyncState`/`saveSyncState`/`SYNC_STATE_STORAGE_KEY`/`PEER_TTL_MS` en `indexed-db.ts`.
- `SyncPeer`/`SyncState` en `shared/domain/types.ts`.
- Deps npm: `jsqr`, `qrcode`, `@types/qrcode`.

**Se mantiene sin tocar:** todo `src/features/backup/`, `shared/infrastructure/compression.ts` (ya era compartido, backup lo sigue usando), `Tombstone`/`Stamped`/tombstones en cada feature con borrado (no son de sync, son del modelo de datos general).

**Se toca (quitar solo la parte de sync, dejando la de backup)**:
- `src/app/dependencies.ts` — quita `qrGateway`/`syncStateRepository`, agrega `authGateway: browserAuthGateway`; `stateRepository: firestoreStateRepository` en vez de `indexedDbStateRepository`.
- `src/app/application/hydrate.ts` — quita `storedSync`/`syncState` de `HydratedState` y del `sequenceS`; quita el import de `makeSyncState`.
- `src/app/application/persist.ts` — quita `persistSyncState`.
- `src/app/persistence.ts` — quita el bloque `unsubscribeSync`.
- `src/app/store/data-slice.ts` — quita `syncState` del `set()` final de `hydrateFromRepositories`.
- `src/app/store/ui-slice.ts` — quita `syncModalOpen`/`setSyncModalOpen`.
- `src/app/store/index.ts` — quita `createSyncSlice`/`SyncSlice` de la composición de `HiloStore`.
- `src/app/ui/Shells.tsx` — quita el import y el `<SyncContainer desktop={desktop} />` de `Sheets`; dos líneas, `BackupContainer` no se toca.
- `src/features/settings/store/settings-actions-slice.ts` — quita `'sync'` de `SettingsTool` y la línea `syncModalOpen: tool === 'sync'`.
- `src/features/settings/ui/containers/SettingsContainer.tsx` — quita `onOpenSync`; agrega `onSignOut` (paso 5).
- `src/features/settings/ui/components/SettingsModal.tsx` — quita el botón "Sincronizar dispositivos"; agrega botón "Cerrar sesión".
- `src/test/render-feature.tsx` — quita `syncStateRepository`/`inMemorySyncStateRepository` de `createDeps(...)` (no hace falta agregar nada de auth: `AuthGate` está *arriba* de `HiloStoreProvider`, así que `renderFeature` — que monta `HiloStoreProvider` directo — nunca pasa por auth; los 190 tests de regresión y los tests de feature existentes quedan intactos en ese sentido).
- `src/app/store/store.test.ts` — quita las aserciones de `syncState`/`inMemorySyncStateRepository`.
- `src/features/settings/ui/settings.test.ts` — quita la aserción del botón de sync, agrega una para el de cerrar sesión.

### 7. Reglas de seguridad de Firestore

`firestore.rules` (nuevo, en la raíz del repo, para tenerlo versionado aunque no se despliegue por CLI):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
Se pega manualmente en la consola de Firebase (pestaña *Reglas* de Firestore) — más rápido que configurar el CLI de `firebase-tools` (que exigiría `firebase login` interactivo) para desplegar una sola regla.

### 8. Config y setup — lo que le toca al usuario

No puedo crear el proyecto de Firebase ni iniciar sesión con Google por ti (acciones de cuenta/credenciales). Lo que sí dejo listo: código que funciona en cuanto exista `.env.local`, y una sección nueva en `README.md` con los pasos exactos:

1. Crear proyecto en [console.firebase.google.com](https://console.firebase.google.com) (plan Spark, gratis).
2. Authentication → Sign-in method → habilitar Google.
3. Firestore Database → crear en modo producción → pestaña Reglas → pegar el contenido de `firestore.rules`.
4. Project settings → agregar una Web App → copiar el objeto de config.
5. Crear `.env.local` (ya cubierto por el patrón `*.local` de `.gitignore`, no hace falta tocarlo) con las 6 variables `VITE_FIREBASE_*` según `.env.example` (nuevo).

`.env.example` (nuevo, sin valores reales, para que quien clone el repo sepa qué necesita) y una nota en `README.md` de que sin estas variables el login simplemente no va a funcionar (falla visible, no un error silencioso).

`.github/workflows/deploy-pages.yml` — agrega los 6 `VITE_FIREBASE_*` como `env:` del paso `npm run build`, leyéndolos de GitHub Actions Secrets. Cargar esos secrets en GitHub (`Settings → Secrets and variables → Actions`) también le toca al usuario — se lo indico explícitamente al terminar, con el nombre exacto de cada secret.

### 9. Documentación a actualizar en el mismo cambio

- `CLAUDE.md` — reescribir la sección **"Product direction: local-only SPA, no backend"** (ya no es cierta tal cual); actualizar **"State flow"** (`stateRepository` real es Firestore, no IndexedDB, con nota de la migración/merge inicial); actualizar la lista de modales (ya no hay `SyncModal`); no cambia la lista de "las doce features" (auth no es una feature nueva, vive en `app`/`shared`, como se explica en el diseño).
- `tasks/desktop-mobile-sync.md` y `tasks/sync-incremental.md` — agregar una nota breve de que quedaron reemplazadas por `backend-sync.md` (sin cambiar su `status: implementada`, porque sí fueron funcionalidad real en su momento).
- `tasks/backend-sync.md` → `status: implementada` al cerrar; `tasks/README.md` → fila actualizada.

---

## Archivos tocados (resumen)

**Nuevos:** `src/shared/infrastructure/firebase.ts`, `src/shared/infrastructure/auth.ts`, `src/shared/domain/export-payload.ts`, `src/app/auth-context.tsx` (incl. estado `error`, ver Verificación) + su test, `src/app/ui/LoginScreen.tsx`, `src/app/application/migrate-to-firestore.ts` + su test, `firestore.rules`, `.env.example`, `src/vite-env.d.ts` (tipos de `import.meta.env.VITE_FIREBASE_*`, no existía precedente de env vars en el repo). (`merge.ts` no se creó en ningún lado nuevo — se borró, ver el punto de migración simplificado arriba.)

**Borrados:** todo `src/features/sync/`, `src/shared/infrastructure/qr.ts`, más las porciones sync-only descritas en el punto 6.

**Modificados:** `src/app/dependencies.ts`, `hydrate.ts`, `persist.ts`, `persistence.ts`, `store/data-slice.ts`, `store/settings-slice.ts`, `store/ui-slice.ts`, `store/index.ts`, `ui/Shells.tsx`, `App.tsx`, `shared/domain/ports.ts`, `shared/domain/types.ts`, `shared/infrastructure/repositories.ts`, `shared/infrastructure/in-memory.ts`, `shared/infrastructure/indexed-db.ts`, `src/features/backup/application/{build-backup,read-backup}.ts` + tests (solo el import), `src/features/settings/**`, `src/test/render-feature.tsx`, `src/app/store/store.test.ts`, `package.json` (+`firebase`, −`jsqr`/`qrcode`/`@types/qrcode`), `.github/workflows/deploy-pages.yml`, `README.md`, `CLAUDE.md`, `tasks/backend-sync.md`, `tasks/README.md`, `tasks/desktop-mobile-sync.md`, `tasks/sync-incremental.md`.

**No previsto en el plan original — descubierto al implementar:** la suite congelada (`test/unit/`, `test/integration/`) también prueba comportamiento que se borró, y `<App/>` ahora exige sesión antes de renderizar nada:
- `test/unit/sync.test.js` / `test/unit/backcompat.test.js` — trimeados: se quitan los tests de `mergeCollection`/`mergeTombstones`/`mergeDataState` y de la rama delta (`since`) de `buildExportPayload` (comportamiento borrado); se conservan los de `buildExportPayload`/`normalizeExportPayload`/`parseExportText`/`replaceDataState`/`recordStamp` (siguen existiendo, solo se movieron).
- `test/unit/persistence.test.js` — se quita el describe de `makeSyncState`/`loadSyncState`/`saveSyncState` (funciones borradas).
- `hilo-finanzas.jsx` (barrel) — el bloque de `sync`/`indexed-db` se actualiza a las rutas/exports nuevos, y se agregan `createDeps`, `indexedDbStateRepository`, `fakeAuthGateway` — los necesita `test/integration/helpers.jsx` para montar `<App/>` con sesión ya resuelta sin tocar Firebase/IndexedDB reales.
- `test/integration/helpers.jsx` — `renderApp()` ahora inyecta `deps` (authGateway de mentira ya logueado + `stateRepository: indexedDbStateRepository`, para no romper `seedState`); esto arregla los 9 archivos de `test/integration/` de un solo lugar.
- `test/integration/persistence-desktop.test.jsx` — un test monta `<App/>` directo (no vía `renderApp()`) para forzar el layout de escritorio; se le agrega la misma inyección de `deps` a mano.
- `test/integration/sync-backup.test.jsx` — se quita el describe de sincronización por texto pegado (`SyncModal` ya no existe); se conserva el de restaurar respaldo.
- `src/features/settings/ui/settings.test.tsx` — se quita el caso de "Sincronizar dispositivos" del `it.each`; se agrega un describe de "cerrar sesión".
- `src/test/setup.js` — `vi.stubEnv` para las 6 `VITE_FIREBASE_*` (si no, `getAuth()`/`getFirestore()` truenan por config inválida en cuanto algo las invoca) y un filtro de `console.error` para el ruido esperado de `getRedirectResult` fuera de un navegador real (ya se atrapa con `.catch`, no rompe nada).
- `vite.config.js` — `testTimeout: 15000` (el default de 5s a veces no alcanzaba para montar `<App/>` completo bajo ejecución paralela, sobre todo el test que la desmonta y remonta).

---

## Verificación

Automatizable por mí, antes de terminar — **hecho**:
1. `npm run typecheck` — sin errores. ✅
2. `npm test` — 46/46 archivos, 382/382 tests en verde (dos corridas seguidas, para descartar el flake de timeouts que apareció antes de hacer `auth()`/`db()` perezosos). ✅
3. `npm run build` — build de producción sin errores (aviso de tamaño de bundle >500KB por el SDK de Firebase; no bloquea, queda para otro día si molesta). ✅
4. `npm run dev` en el navegador embebido. ✅ Encontró un problema real que el plan no había previsto: sin `.env.local`, `auth()` avienta *dentro* del `useEffect` de `AuthGate` y, sin manejo, React se queda en una pantalla en blanco (no un error legible). Se agregó un cuarto estado `{ kind: 'error' }` a `AuthGate` — try/catch alrededor de la suscripción — que muestra un mensaje claro en vez de crashear. Verificado con y sin config: sin `.env.local` → mensaje "No se pudo conectar con Firebase…"; con config válida-pero-de-mentira → pantalla de login normal (screenshots tomados en el navegador embebido). Se agregó `src/app/auth-context.test.tsx` cubriendo los tres estados (login, logout/signOut, error).
   - Nota aparte, no relacionada con este código: el navegador embebido mostró "two copies of React" tras el reinicio del dev server — es el service worker de la PWA cacheando el grafo de módulos anterior (falso positivo ya documentado en memoria de sesiones previas), no un bug de esta migración. Se resuelve desregistrando el SW y limpiando cachés desde una pestaña nueva.

Requiere que tú lo hagas (no puedo iniciar sesión de Google por ti):
1. Los 5 pasos de configuración del punto 8 (crear proyecto, habilitar Google, Firestore + reglas, `.env.local`).
2. **Iniciar sesión primero en tu teléfono** (fuente de la verdad) — `npm run dev`/build de prueba o el deploy — y confirmar que ves tus datos actuales de ese dispositivo (la migración los subió).
3. Iniciar sesión después en tu compu y confirmar que ves los mismos datos del teléfono (Firestore ya no estaba vacío, así que no subió nada local de la compu — comportamiento esperado, ya aceptado).
4. Confirmar que "Cerrar sesión" vuelve a la pantalla de login y que un dato agregado en un dispositivo aparece en el otro tras recargar (sin QR ni archivos).
5. Cargar los 6 secrets `VITE_FIREBASE_*` en GitHub Actions y confirmar que el deploy a Pages sigue funcionando con login real.

### Ajuste post-lanzamiento (encontrado al usar la app real, no en la verificación de arriba)

El punto 2 de arriba resultó no ser tan directo — el login en un dispositivo real (teléfono, Android, ícono instalado) sacó a la luz varios problemas que la verificación automatizada no podía cubrir (no hay forma de correr `signInWithPopup`/`signInWithRedirect` real bajo test):

1. **`onSignIn` descartaba el error de `signInWithGoogle()`** (`void deps.authGateway.signInWithGoogle()`, sin `.catch`) — un fallo dejaba al usuario de vuelta en el botón de login sin ninguna pista. Se agregó estado `signInError` en `AuthGate`, mostrado en `LoginScreen`.
2. Eso no bastó para el caso real: **el ícono instalado (PWA, modo standalone) usa `signInWithRedirect`**, cuyo resultado se resuelve después de recargar, dentro de `ensureRedirectChecked()` — y ese error solo se mandaba a `console.error`, nunca a la UI. Se agregó un segundo parámetro opcional `onError` a `AuthGateway.onAuthStateChanged` para que ese fallo también llegue a `signInError`.
3. **Bug de fondo más serio, no del login sino del guardado automático**: `subscribePersistence` disparaba un guardado en el instante en que `loaded` pasaba a `true`, aunque nada hubiera cambiado — heredado del `useEffect` original (necesario ahí para persistir la semilla de demo en IndexedDB en un perfil nuevo). Con Firestore compartido entre dispositivos eso es destructivo: un dispositivo que hidrata con Firestore momentáneamente vacío (p. ej. una carrera con el restore de otro dispositivo) autoguardaba la semilla de demo encima del dato real. Se reprodujo en producción (un restore de respaldo en el teléfono se perdió al abrir la app en la compu). Arreglado quitando `loaded` del array que vigila la suscripción — un guardado ahora solo se dispara por un cambio real de las 6 colecciones.
4. **El límite de 1 MiB por documento, que el punto 4 de "Diseño" ya anticipaba como riesgo, se topó de inmediato**: el primer restore de un respaldo real (años de historial) pesaba 2.98 MB sin comprimir. En vez de migrar a subcolecciones (mucho más trabajo, ver "Modelo de datos" en la task), se resolvió comprimiendo el blob con gzip (`gzipString`/`gunzipBytes`, ya existían para el respaldo manual) antes de escribirlo como `Bytes` de Firestore — `load` sigue sabiendo leer el shape viejo (objeto plano) por compatibilidad con lo que ya se hubiera escrito. Sin cambios al puerto `StateRepository`.
5. Para diagnosticar el punto 4 hizo falta agregar `console.error` con la causa completa de un `PersistenceError` en `persistence.ts` — antes solo llegaba el toast fijo ("No se pudo guardar el cambio localmente", contrato de test), sin ningún detalle en consola.
