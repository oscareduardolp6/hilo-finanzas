# Hilo

Control de gastos personal (UI en español de México, moneda MXN). Todo el producto vive en un solo componente de React: [hilo-finanzas.jsx](hilo-finanzas.jsx).

## Requisitos

- Node.js 18 o superior (probado con Node 23) y npm.

## Ejecutar en local

```bash
npm install
npm run dev
```

Esto levanta un servidor de desarrollo con Vite (por defecto en `http://localhost:5173`) que monta el componente `App` de `hilo-finanzas.jsx`.

Otros comandos disponibles:

```bash
npm run build    # build de producción a dist/
npm run preview  # sirve el build de dist/ para revisarlo localmente
```

## Deploy

La app está publicada como sitio estático en GitHub Pages: **https://oscareduardolp6.github.io/hilo-finanzas/**

El deploy es automático: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) corre `npm run build` y publica `dist/` en cada push a `master`. El `base` de Vite ([vite.config.js](vite.config.js)) está fijado a `/hilo-finanzas/` para que coincida con la ruta del *project page*; si el repo cambia de nombre, hay que actualizar ese valor.

## Nota sobre el guardado de datos

Por ahora, `hilo-finanzas.jsx` guarda los datos usando `window.storage` (la API del host de Claude Artifacts), que **no existe** al correr la app con este servidor local — vas a ver un aviso de "tus cambios no se están guardando" y los datos se reinician al recargar la página. La idea del proyecto es que sea una SPA sin backend que guarde todo localmente en el navegador (por ejemplo con IndexedDB), pero ese mecanismo todavía no está implementado. Más contexto en [CLAUDE.md](CLAUDE.md).

Si quieres ver la app con el guardado funcionando mientras tanto, publica `hilo-finanzas.jsx` como un Claude Artifact.
