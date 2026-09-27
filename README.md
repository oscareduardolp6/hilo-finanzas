# Hilo

Control de gastos personal (UI en español de México, moneda MXN), como SPA de React con Firebase (Firestore + Auth) como backend de datos.

> **Arquitectura en capas.** El producto vivía en un solo componente de 4721 líneas; hoy está
> repartido en capas feature-first (TypeScript, fp-ts, zustand) bajo `src/app/`, `src/shared/` y
> `src/features/<f>/`. El porqué de cada decisión está en
> [agents/plans/layered-architecture.md](agents/plans/layered-architecture.md).
> [hilo-finanzas.jsx](hilo-finanzas.jsx) quedó como *barrel* de re-exports, que es lo que permitió
> hacer el refactor sin tocar una línea de los 190 tests de regresión.

## Requisitos

- Node.js 18 o superior (probado con Node 23) y npm.
- Un proyecto de Firebase propio (gratis, plan Spark) — ver el siguiente paso.

## Configurar tu propio proyecto de Firebase

La app pide iniciar sesión con Google antes de mostrar cualquier dato — sin esto no arranca.

1. Crea un proyecto en [console.firebase.google.com](https://console.firebase.google.com) (plan Spark, gratis).
2. **Authentication** → *Sign-in method* → habilita **Google**.
3. **Firestore Database** → créala en **modo producción** → pestaña *Reglas* → pega el contenido de [firestore.rules](firestore.rules) (deja tus datos bloqueados a tu propia cuenta).
4. **Configuración del proyecto** → agrega una **Web App** → copia el objeto de config.
5. Copia [.env.example](.env.example) a `.env.local` (ya está cubierto por `*.local` en `.gitignore`, nunca se sube) y pon ahí los 6 valores.

Sin `.env.local`, la pantalla de login truena visiblemente en la consola (Firebase se queja de un `apiKey` inválido) en vez de fallar en silencio.

## Ejecutar en local

```bash
npm install
npm run dev
```

Esto levanta un servidor de desarrollo con Vite (por defecto en `http://localhost:5173`) que monta el componente `App`.

Otros comandos disponibles:

```bash
npm run build      # build de producción a dist/
npm run preview    # sirve el build de dist/ para revisarlo localmente
npm run typecheck  # TypeScript (tsc --noEmit)
```

## Tests

```bash
npm test          # una pasada (Vitest)
npm run test:watch
npm run test:cov  # + cobertura sobre src/
```

`test/unit/` prueba la lógica pura y de negocio importada de `hilo-finanzas.jsx`
(totales, `planProgress`, formato de export/respaldo, importación de Monefy, OCR…).
`test/integration/` monta `<App/>` con React Testing Library y `fake-indexeddb` y
recorre los flujos críticos (alta/edición/borrado de movimientos, MSI, filtros y
buscador del historial, cuentas, respaldar, importar Monefy, escanear ticket) — con
una sesión de Google ya resuelta de mentira, ver `test/integration/helpers.jsx`.
Detalle y decisiones en [agents/plans/testing.md](agents/plans/testing.md).

Esas dos carpetas son la **red de regresión del refactor y no se tocan**. Los tests nuevos van junto
a la feature que prueban, en `src/**/*.test.{ts,tsx}`.

## Deploy

La app está publicada como sitio estático en GitHub Pages: **https://oscareduardolp6.github.io/hilo-finanzas/**

El deploy es automático: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) corre `npm run build` y publica `dist/` en cada push a `master`. El `base` de Vite ([vite.config.js](vite.config.js)) está fijado a `/hilo-finanzas/` para que coincida con la ruta del *project page*; si el repo cambia de nombre, hay que actualizar ese valor.

El build necesita los 6 `VITE_FIREBASE_*` (ver arriba) — el workflow los toma de **GitHub → Settings → Secrets and variables → Actions**, con el mismo nombre que en `.env.example`.

## Guardado de datos

Los datos viven en **Firestore** (un documento por usuario, ver [src/shared/infrastructure/repositories.ts](src/shared/infrastructure/repositories.ts)), sincronizados automáticamente entre dispositivos con la misma sesión de Google — sin QR ni archivos a mano. La sesión (Google Sign-In) es obligatoria: [src/app/auth-context.tsx](src/app/auth-context.tsx) bloquea el resto de la app hasta iniciar sesión.

`indexedDbStateRepository` ([src/shared/infrastructure/indexed-db.ts](src/shared/infrastructure/indexed-db.ts)) sigue existiendo, pero solo como snapshot histórico de este dispositivo: al iniciar sesión por primera vez, si Firestore está vacío, se sube ese snapshot una sola vez (ver `src/app/application/migrate-to-firestore.ts`); si Firestore ya tiene datos, gana la nube. Para copias de seguridad manuales está Ajustes → **Respaldo de datos** (exporta todo a `.json` y restaura reemplazando). Más contexto en [CLAUDE.md](CLAUDE.md) y [tasks/backend-sync.md](tasks/backend-sync.md).
