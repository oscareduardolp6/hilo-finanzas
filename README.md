# Hilo

Control de gastos personal (UI en español de México, moneda MXN), como SPA de React sin backend.

> **Refactor en curso.** El producto vivía en un solo componente de 4721 líneas y se está migrando a
> una arquitectura en capas feature-first (TypeScript, fp-ts, zustand). El registro de qué módulos ya
> se movieron está en [agents/plans/layered-architecture.md](agents/plans/layered-architecture.md).
> Hoy conviven `src/legacy/hilo-legacy.jsx` (lo pendiente) con `src/shared/` y `src/features/` (lo
> migrado); [hilo-finanzas.jsx](hilo-finanzas.jsx) quedó como *barrel* de re-exports.

## Requisitos

- Node.js 18 o superior (probado con Node 23) y npm.

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
(totales, `planProgress`, merge de sincronización, importación de Monefy, OCR…).
`test/integration/` monta `<App/>` con React Testing Library y `fake-indexeddb` y
recorre los flujos críticos (alta/edición/borrado de movimientos, MSI, filtros y
buscador del historial, cuentas, sincronizar/respaldar, importar Monefy, escanear
ticket). Detalle y decisiones en [agents/plans/testing.md](agents/plans/testing.md).

Esas dos carpetas son la **red de regresión del refactor y no se tocan**. Los tests nuevos van junto
a la feature que prueban, en `src/**/*.test.{ts,tsx}`.

## Deploy

La app está publicada como sitio estático en GitHub Pages: **https://oscareduardolp6.github.io/hilo-finanzas/**

El deploy es automático: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) corre `npm run build` y publica `dist/` en cada push a `master`. El `base` de Vite ([vite.config.js](vite.config.js)) está fijado a `/hilo-finanzas/` para que coincida con la ruta del *project page*; si el repo cambia de nombre, hay que actualizar ese valor.

## Guardado de datos

Hilo guarda todo **localmente en el navegador** con IndexedDB (base `hilo_finanzas`, ver `openDb`/`loadState`/`saveState` en [src/shared/infrastructure/indexed-db.ts](src/shared/infrastructure/indexed-db.ts)). Los datos persisten al recargar, tanto en escritorio como en móvil. No hay backend ni sincronización automática.

Para pasar datos de un dispositivo a otro hay un traspaso manual (Ajustes → **Sincronizar dispositivos**): archivo `.json`, texto comprimido, o QR, y el destino los combina por `id`. Para copias de seguridad está Ajustes → **Respaldo de datos** (exporta todo y restaura reemplazando). Más contexto en [CLAUDE.md](CLAUDE.md) y [tasks/desktop-mobile-sync.md](tasks/desktop-mobile-sync.md).
