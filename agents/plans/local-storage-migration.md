# Plan: Migrar a IndexedDB para guardado local

> Implementa [tasks/local-storage-migration.md](../../tasks/local-storage-migration.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

[hilo-finanzas.jsx](../../hilo-finanzas.jsx) persistía usando `window.storage.get`/`.set`, la API que el host de Claude Artifacts inyecta en el `window` del iframe. Eso solo funcionaba cuando el archivo corría publicado como Artifact; en dev local (o cualquier navegador normal) esas llamadas fallaban silenciosamente y nada persistía entre recargas — justo el problema que documentaba [CLAUDE.md](../../CLAUDE.md) en "Product direction: local-only SPA, no backend".

Se confirmaron con el usuario las decisiones que la task dejaba abiertas:

1. **IndexedDB con API nativa**, sin librería wrapper (`idb`, etc.) — para un solo object store con `get`/`put` la API nativa envuelta en unas pocas promesas es suficiente y evita sumar una dependencia para algo simple. (No hay restricción de dependencias por correr en un sandbox de Artifact — ver punto 4, ese modo ya no se mantiene.)
2. **Sin versionado de esquema** en el blob guardado — se guarda el mismo shape de antes (`{ accounts, categories, transactions, installmentPlans }`), sin campo de versión. Si el modelo de datos cambia más adelante, se resuelve entonces.
3. **Aviso visible si falla el guardado** — a diferencia del silencio anterior con `window.storage`, un error real de IndexedDB (guardado fallido, no disponible) se muestra con el sistema de `Toast` que ya existía en la app, en vez de fallar en silencio.
4. **Se dejó de dar soporte al modo Artifact.** El usuario confirmó explícitamente: *"el modo artifact era solo para prototipar y ver la viabilidad, ya nos vamos a pasar a otra forma de hacerlo, no le des mantenimiento a que se pueda usar como artifact, solo no dependas de un backend y asegúrate de que funcione en mobile"*. Es un reemplazo completo de `window.storage`, no un fallback dual — correr el archivo como Artifact publicado ya no persiste datos (documentado en CLAUDE.md). IndexedDB tiene soporte amplio en navegadores móviles (Safari iOS, Chrome Android).

## Diseño

Todo el cambio vive en **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)**, junto a la sección de helpers (cerca de `STORAGE_KEY`) y dentro de `App`.

### Helpers de IndexedDB (nuevos, junto a `STORAGE_KEY`)

Tres funciones basadas en Promises envolviendo la API nativa `indexedDB`, sin dependencias nuevas: `openDb()` abre/crea la base `hilo_finanzas` (versión 1) con un único object store `state`; `loadState()` hace `get(STORAGE_KEY)`; `saveState(data)` hace `put(data, STORAGE_KEY)`. IndexedDB guarda objetos estructurados directamente, así que ya no hace falta `JSON.stringify`/`JSON.parse` como con `window.storage` (que solo aceptaba strings) — esto simplifica los dos `useEffect` de `App`.

### `App`: reemplazo de los dos `useEffect` de persistencia

El `useEffect` de carga cambia `window.storage.get(STORAGE_KEY)` + `JSON.parse` por `await loadState()` directo — misma lógica de hidratar cada colección si viene presente, mismo `finally { setLoaded(true) }`, mismo `catch` silencioso (sin datos previos = se queda con la demo seed).

El `useEffect` de guardado cambia `window.storage.set(STORAGE_KEY, JSON.stringify(...))` por `await saveState({ accounts, categories, transactions, installmentPlans })`. La diferencia clave es el `catch`: en vez de ignorar el error, llama `setToast('No se pudo guardar el cambio localmente')`, reusando el mecanismo de `Toast` ya existente (`setToast` + el `useEffect` de auto-dismiss a 2200ms, sin cambios).

No se tocó nada más de `App` (estado, memos, JSX, modales) — el cambio quedó localizado a las dos funciones de carga/guardado.

## Archivos tocados

1. **`hilo-finanzas.jsx`** — helpers `openDb`/`loadState`/`saveState` (nuevos, junto a `STORAGE_KEY`), reemplazo de los dos `useEffect` de persistencia en `App`, toast de error en el guardado.
2. **`CLAUDE.md`** — se actualizó "Product direction: local-only SPA, no backend", "Running it" y "State flow" para reflejar IndexedDB en vez de `window.storage`, y que el modo Artifact ya no persiste (dejado de mantener a propósito).
3. **`agents/plans/local-storage-migration.md`** — este plan.
4. **`tasks/local-storage-migration.md`** — `status: implementada`.
5. **`tasks/README.md`** — fila de la tabla actualizada a "Implementada".

## Verificación

1. `npm run dev`, abrir en navegador (desktop).
2. Capturar una transacción nueva, recargar la página → sigue ahí.
3. Editar/eliminar una cuenta, un plan MSI y una transacción, recargar cada vez → los cambios persisten.
4. DevTools → Application → IndexedDB → confirmar que existe la base `hilo_finanzas` con el object store `state` y el blob esperado.
5. Viewport mobile (`resize_window` preset `mobile`), repetir el flujo de captura + recarga — sin errores de consola, persiste igual.
6. Revisar la ruta de `catch` en el guardado y confirmar que dispara el toast de error en vez de fallar en silencio.
7. Sin errores de consola en ningún escenario.

## Estado post-implementación

_(Actualizar esta sección si algo se implementó distinto a lo descrito arriba — ver la nota de sincronización en CLAUDE.md.)_

Implementado tal como se describe en este plan.
