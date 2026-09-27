---
status: implementada
priority: 2
---

# Sincronización automática con backend (Firebase)

Hoy Hilo es una SPA sin backend: cada dispositivo guarda su estado en IndexedDB y la
única forma de llevar datos de uno a otro es manual — [desktop-mobile-sync.md](desktop-mobile-sync.md)
(QR / archivo / texto) y su capa incremental, [sync-incremental.md](sync-incremental.md)
(deltas por "punto de sincronización" entre dispositivos). Ambas tareas ya dejaban
anotado que esto era un parche hasta tener "un backend real con sincronización
automática" — esta task es esa continuación.

Objetivo: que lo que se registra en un dispositivo aparezca solo en los demás, sin QR
ni exportar/importar archivos a mano. Prioridades del usuario, en orden: **rápido de
implementar, barato, seguro** — la app sigue siendo de un solo usuario (yo) pero está
desplegada públicamente, así que nadie más debe poder leer ni escribir esos datos, ni
usar el proyecto para guardar los suyos.

## Decisión: Firebase (Firestore + Firebase Auth)

Comparado con Supabase, un backend propio (Node + Postgres) o self-host (PocketBase,
etc.), Firebase gana en las tres prioridades para este caso:

- **Rápido**: sin servidor que escribir, desplegar ni mantener — reglas de seguridad
  declarativas en vez de una API con auth casera. El SDK trae persistencia offline
  (caché local con IndexedDB propio, aparte del `indexed-db.ts` de Hilo) y listeners en
  tiempo real (`onSnapshot`), así que "funciona sin internet y sincroniza al volver" no
  hay que escribirlo — self-host (PocketBase) sí exige mantener uptime del servidor.
- **Barato**: free tier (Spark) — Firestore da 50K lecturas / 20K escrituras / 20K
  borrados por día y 1 GiB de almacenamiento; Firebase Auth es gratis para
  email/password y Google Sign-In sin límite de usuarios. Un solo usuario de finanzas
  personales no se acerca a esas cuotas — costo esperado: **$0/mes indefinidamente**.
- **Seguro**: las Firestore Security Rules se evalúan en la infraestructura de Google,
  no en el JS del navegador (que cualquiera puede leer/editar en devtools). El
  `apiKey` de Firebase **no es secreto** — identifica el proyecto, no autoriza nada; lo
  que protege los datos es la regla, no ocultar la config.

Encaja además con la arquitectura de puertos que ya tiene Hilo: `StateRepository`
([src/shared/domain/ports.ts](../src/shared/domain/ports.ts)) ya es `load`/`save` de
un blob completo (`DataState`), igual que hoy lo implementa
`indexedDbStateRepository` en
[src/shared/infrastructure/repositories.ts](../src/shared/infrastructure/repositories.ts)
sobre `indexed-db.ts`. Un `firestoreStateRepository` es una segunda implementación del
mismo puerto, inyectada en `src/app/dependencies.ts` — mismo patrón que la
implementación en memoria que ya usan los tests, sin tocar casos de uso ni UI.

## Autenticación y modelo multiusuario a futuro

Se preguntó si abrir la app a más gente en el futuro sería más fácil con Google
Sign-In o con email/contraseña — la respuesta corta es que **el método de login casi
no importa para eso**: Firebase Auth ya soporta cualquier cantidad de usuarios con
cualquiera de los dos. Lo que sí importa es diseñar bien desde ahora:

- **Login: Google Sign-In.** Un clic, nada que mantener (sin contraseña propia que
  recordar ni recuperar). Sigue siendo trivial migrar a email/password después si hace
  falta invitar a alguien sin cuenta de Google.
- **Modelo de datos por usuario desde el día uno**, aunque hoy solo exista uno:
  `users/{uid}/...` en vez de una colección plana. Así, si el día de mañana se decide
  abrir la app, el cambio es **solo la regla de seguridad** (dejar de exigir un `uid`
  fijo, o agregar una colección `allowlist`), sin migrar datos ni reestructurar
  Firestore.
- Si se abre a más gente después y se quiere que sea por invitación (no cualquiera con
  cuenta de Google), Firebase soporta un *blocking trigger* (`beforeCreate` en Cloud
  Functions) para validar el email contra una lista antes de dejar completar el
  registro — se documenta aquí como opción, no hace falta ahora con un solo usuario.
- Regla mínima para hoy (bloqueada a mí) — ver [firestore.rules](../firestore.rules):
  ```
  match /users/{uid} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```

## Qué pasa con la sincronización manual actual

Decidido con el usuario:

- **Se elimina `SyncModal`** (QR + texto comprimido + deltas) — deja de tener sentido
  con sync automática. Con eso se van también: el gateway de QR (`QrGateway`), las
  dependencias `qrcode` y `jsqr`, `gzipString`/`gunzipBytes`, `SyncStateRepository` y
  todo el modelo de `peers`/`lastSentAt`/`lastReceivedAt` de
  [sync-incremental.md](sync-incremental.md). Ambas tasks (`desktop-mobile-sync.md`,
  `sync-incremental.md`) se marcan como reemplazadas cuando esto se implemente.
- **Se mantiene `BackupModal`** (exportar `.json` completo / restaurar reemplazando
  todo) como respaldo manual — sigue siendo útil independientemente de tener backend
  (copia de seguridad local, portabilidad, y además sirve como mecanismo de migración
  inicial, ver abajo).

## Datos existentes: migración

Los usuarios (yo) ya tienen datos reales en IndexedDB. Al implementar:

1. Primer login con Google → si Firestore no tiene datos para ese `uid` pero
   `indexedDbStateRepository.load()` sí devuelve algo, subir ese blob una sola vez
   (reutiliza `loadState()` de `indexed-db.ts` tal cual, sin escribir nada nuevo para
   leer lo local).
2. A partir de ahí, `StateRepository` activo pasa a ser el de Firestore; IndexedDB dejaría
   de ser la fuente de verdad para los datos financieros (persistencia offline la sigue
   dando el propio SDK de Firestore). `OcrSettingsRepository` y `HideBalancesRepository`
   — configuración local del dispositivo, nunca viajan en sync/QR/respaldo — se quedan
   igual que hoy, sin cambios.

## Modelo de datos en Firestore (a decidir en el plan de implementación)

Dos caminos, con distinto costo de implementación:

- **Un solo documento** `users/{uid}/data/state` con el blob completo (las seis
  colecciones tal cual `DataState`). Es el cambio más chico: `firestoreStateRepository`
  queda casi como un calco de `indexedDbStateRepository`, solo cambia dónde lee/escribe.
  Límite de Firestore: 1 MiB por documento — probablemente alcanza por años de
  historial de un solo usuario, pero es una pared con la que se puede topar eventualmente.
- **Subcolecciones por tipo de registro** (`users/{uid}/transactions/{id}`, etc., un
  documento por registro). Sin límite de tamaño práctico, permite lecturas/escrituras
  incrementales (no reescribir todo el blob en cada cambio) y sync en tiempo real más
  granular — pero es más trabajo: el puerto `StateRepository` ya no mapea 1:1 (`load`
  tendría que leer N colecciones, `save` no tiene sentido tal cual) y tocaría
  rediseñar esa parte del puerto.

Dado que "rápido" es la prioridad #1, la recomendación es **empezar con un solo
documento** y solo migrar a subcolecciones si el tamaño se vuelve un problema real.

## Login: decidido con el usuario

- **Pantalla de login bloqueante** antes de montar la app (no hay modo "usable sin
  sesión"): coherente con que Firestore reemplaza a IndexedDB como fuente de verdad —
  no tiene caso mostrar una app vacía o con datos viejos antes de saber quién eres.
  Un solo botón "Iniciar sesión con Google", nada más. Vive en el composition root
  (`src/app/`), no dentro de una feature — es lo primero que decide qué árbol montar,
  antes incluso de `useIsDesktop()`.
- **`signInWithPopup` por defecto; `signInWithRedirect` solo en PWA standalone.**
  Decisión original (redirect siempre, por la PWA) revertida tras probarlo en vivo:
  `signInWithRedirect` se queda pegado en la pantalla de login sin ningún error —
  depende de un viaje ida-vuelta por `authDomain` que usa storage de terceros, y
  Chrome lo bloquea cada vez más agresivamente. Popup no tiene ese problema. Redirect
  se conserva solo para cuando la app corre instalada ([pwa-install.md](pwa-install.md)),
  donde sí es el popup el que falla.
- Sesión persistida por el propio SDK de Firebase Auth — sobrevive recargas y
  reinicios sin relogin. Botón "Cerrar sesión" en Ajustes (poco usado con un solo
  usuario, pero necesario para poder probar con otra cuenta).
- **Puerto nuevo `AuthGateway`** junto a `ClipboardGateway`/`ShareGateway` en
  [ports.ts](../src/shared/domain/ports.ts): `signIn`, `signOut`, `onStateChanged`.
  Doble en memoria para tests, mismo patrón que los demás gateways.
- **Slice de store nuevo** con `user` (`{ uid, email, ... } | null`) y `authLoading`.
- **Cambio estructural en el composition root**: hoy `dependencies.ts` arma `Deps` una
  sola vez y de forma estática al arrancar. Con Firestore, `stateRepository` necesita
  el `uid` para construir la ruta `users/{uid}/data/state`, así que esa pieza de `Deps`
  ya no puede armarse antes de resolver la sesión — se construye después de conocer el
  `uid`, no en el composition root de siempre. El resto de `Deps` (gateways de
  navegador, `Clock`, `IdGenerator`) sigue estático. Ningún caso de uso ni componente
  se entera de este cambio.
- **Extra de seguridad barato**: restringir el `apiKey` de Firebase al dominio
  desplegado en Google Cloud Console (HTTP referrer restriction) — no reemplaza a las
  Firestore rules (esas son las que protegen los datos de verdad), pero es una capa
  adicional gratis, de un clic.

## Preguntas abiertas para el plan de implementación

- ¿Un doc por usuario o dividir en subcolecciones desde el principio? (ver arriba —
  default sugerido: un doc).
- ¿Listener en tiempo real (`onSnapshot`, refleja cambios de otro dispositivo sin
  recargar) desde la primera versión, o `load` puntual al hidratar y dejar tiempo real
  para después?
- Actualizar `CLAUDE.md`: la sección "Product direction: local-only SPA, no backend" ya
  no sería cierta tal cual está escrita — hay que reescribirla, no solo añadir una nota.

## Cómo quedó (implementada)

Ver [agents/plans/backend-sync.md](../agents/plans/backend-sync.md) para el detalle completo. En resumen:

- **Firestore** (un documento por usuario, `users/{uid}`) + **Firebase Auth** (Google Sign-In, login bloqueante) reemplazan a IndexedDB como fuente de verdad; `indexedDbStateRepository` sigue viva solo para la migración inicial.
- **Migración simple, sin merge**: al iniciar sesión, si Firestore está vacío se sube el snapshot local de ese dispositivo; si ya tiene datos, gana la nube (decisión del usuario: el teléfono es la fuente de la verdad, inicia sesión ahí primero).
- **`SyncModal`/QR/deltas se borraron por completo**; `BackupModal` queda intacto como respaldo manual.
- `AuthGate` vive fuera del store de zustand (única excepción documentada al patrón "todo pasa por el store"), con manejo explícito de un cuarto estado de error (config de Firebase ausente/inválida) para no dejar al usuario ante una pantalla en blanco.
- La suite congelada (`test/unit/`, `test/integration/`) se actualizó donde probaba comportamiento borrado (merge, delta sync, sync-state) — deliberado, no un test desactualizado (ver CLAUDE.md).
- Pendiente de tu lado: crear el proyecto de Firebase, pegar las reglas de `firestore.rules`, `.env.local`, y cargar los 6 secrets en GitHub Actions — pasos documentados en README.md.
