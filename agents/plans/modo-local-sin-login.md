# Plan: modo local sin login

Implementa [tasks/modo-local-sin-login.md](../../tasks/modo-local-sin-login.md).

## Diseño

`AuthGate` ya no bloquea: cuando `onAuthStateChanged` entrega `null`, monta a los hijos
igual, con `useAuth().user === null`. El contexto ganó `signIn` y `signInError` (el botón
de login ya no está en una pantalla propia, así que el error tiene que viajar por
contexto hasta donde esté el botón).

Quien decide de dónde salen los datos es `App.tsx` → `SessionStore`: con usuario usa
`deps` tal cual; sin usuario, `localDeps(deps)` ([dependencies.ts](../../src/app/dependencies.ts)),
que pone `legacyLocalStateRepository` (IndexedDB) como `stateRepository`. El
`HiloStoreProvider` lleva `key={user?.uid ?? 'local'}`: iniciar o cerrar sesión monta un
store nuevo que hidrata de su propia fuente — no se arrastra estado entre modos.

## Decisiones

- **Misma clave de IndexedDB que el snapshot "legacy"** (no una clave "demo" aparte):
  así los datos que alguien armó en local pueden migrar a su Firestore al iniciar sesión
  (`migrate-to-firestore.ts`, sin cambios: en modo local `stateRepository` y legacy son el
  mismo, y la migración queda como no-op). Contrapartida: en un dispositivo que ya tuvo
  datos locales previos a Firestore, "Cerrar sesión" muestra ese snapshot viejo.
- **Cero cambios en persistencia/hidratación**: `persistence.ts` guarda en
  `deps.stateRepository`, que en modo local es IndexedDB. Sigue sin guardar la semilla de
  demo hasta el primer cambio real.
- **`LoginScreen` se borró** (código muerto). El error de Firebase mal configurado
  (`status: 'error'`) se queda como estaba.

## Archivos

- `src/app/auth-context.tsx`, `src/app/App.tsx`, `src/app/dependencies.ts`
- `src/features/settings/ui/{components/SettingsModal,containers/SettingsContainer}.tsx`
- `src/test/render-feature.tsx` (el valor del contexto ganó campos)
- Tests: `src/app/auth-context.test.tsx` (actualizado a propósito: ya no hay pantalla de
  login) y `src/app/local-mode.test.tsx` (nuevo, `<App/>` completo).
