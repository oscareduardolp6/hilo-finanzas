# Plan: Instalar Hilo como PWA

> Implementa [tasks/pwa-install.md](../../tasks/pwa-install.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

[tasks/pwa-install.md](../../tasks/pwa-install.md) pide que Hilo sea instalable (ícono, splash, modo standalone) ahora que [local-storage-migration.md](../../tasks/local-storage-migration.md) ya persiste los datos vía IndexedDB fuera del contexto de Artifact — instalarla solo tiene sentido con esa base resuelta.

Se confirmaron con el usuario las dos decisiones que la task dejaba abiertas:

1. **Service worker con caché del app shell**, no solo el mínimo de instalabilidad — la app debe poder abrir sin conexión después de la primera carga exitosa.
2. **Ícono: glifo de billetera** en dorado (`#C9A24B`, el `COLORS.accent` de la app) sobre fondo verde oscuro (`#0F1A17`, `COLORS.bg`) — reutiliza la paleta de marca ya definida en [hilo-finanzas.jsx](../../hilo-finanzas.jsx).

Se sigue la convención de este repo de no agregar dependencias/wrappers para cosas que la plataforma ya resuelve de forma nativa (mismo criterio que se usó para IndexedDB sin wrapper) — el manifest y el service worker se escriben a mano, sin `vite-plugin-pwa`.

**Fuera de alcance del componente único:** a diferencia de otras tasks, esto no vive dentro de `hilo-finanzas.jsx` — el manifest, el service worker y los íconos son artefactos estáticos servidos por Vite, análogos al scaffold de `src/main.jsx`/`index.html` que CLAUDE.md ya trata como "plumbing" fuera de la arquitectura del producto.

## Diseño

### Íconos (`public/icons/`)

Generados con un script Node de un solo uso (sin dependencias nuevas: `zlib` + un encoder PNG mínimo escrito a mano). Glifo: billetera geométrica (rectángulo redondeado dorado, con una línea horizontal y un círculo recortados en verde oscuro para sugerir la solapa y el broche). Archivos finales, comprometidos como binarios estáticos en el repo:

- `icon-192.png` — 192×192, `purpose: any`
- `icon-512.png` — 512×512, `purpose: any`
- `maskable-icon-512.png` — 512×512, `purpose: maskable` (glifo más pequeño, centrado, con margen de seguridad para el recorte de máscara de Android)
- `apple-touch-icon.png` — 180×180 (iOS, sin transparencia, fondo a sangre completa)
- `favicon-48.png` — 48×48 (ícono de pestaña nítido)

### `public/manifest.json`

Nombre completo "Hilo — Control de gastos", `short_name: "Hilo"`, `display: "standalone"`, `background_color`/`theme_color` en `#0F1A17`, y los 3 íconos (`any` 192/512 + `maskable` 512) referenciados por ruta absoluta.

### `public/sw.js` — service worker con caché de app shell

Sin build tooling de Workbox: estrategia hand-rolled de **network-first con fallback a caché** para navegaciones (documento HTML), y **stale-while-revalidate** para el resto de peticiones GET del mismo origen (JS/CSS con hash de Vite, manifest, íconos):

- `install`: `self.skipWaiting()` — no precachea una lista fija (los nombres de archivo de Vite llevan hash y cambian en cada build; en vez de eso, la caché se va llenando de forma perezosa en el primer `fetch` de cada asset).
- `activate`: borra cachés de versiones anteriores (`CACHE_NAME` versionado, `hilo-shell-v1` — se sube el sufijo a mano cuando se necesite forzar invalidación) y llama `clients.claim()`.
- `fetch`:
  - Peticiones de navegación (`request.mode === 'navigate'`): intenta red primero; si falla, responde desde caché (el `index.html` cacheado en la visita anterior).
  - Resto de GET mismo-origen: responde desde caché inmediatamente si existe mientras revalida en segundo plano (`stale-while-revalidate`); si no hay entrada, va a red y cachea la respuesta.
  - Ignora peticiones no-GET y cross-origin.

### Registro del service worker — `src/main.jsx`

Igual que `App` se monta ahí (plumbing, no parte del árbol de `hilo-finanzas.jsx`): `navigator.serviceWorker.register('/sw.js')` tras el evento `load`, detrás de un chequeo de soporte (`'serviceWorker' in navigator`).

### `index.html`

`<link rel="manifest">`, `<meta name="theme-color">`, favicon PNG, `apple-touch-icon`, y las metaetiquetas `apple-mobile-web-app-*` para el modo standalone en iOS.

## Archivos tocados

- `public/icons/icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`, `favicon-48.png` — nuevos binarios.
- `public/manifest.json` — nuevo.
- `public/sw.js` — nuevo.
- `src/main.jsx` — registro del service worker.
- `index.html` — `<link>`/`<meta>` de manifest, theme-color e íconos.
- `agents/plans/pwa-install.md` — este plan.
- `tasks/pwa-install.md` — status e "Abierto / por decidir" resuelto.
- `tasks/README.md` — fila de la tabla actualizada.

## Verificación

Con `npm run dev` (Vite sirve `public/` en la raíz automáticamente, sin config extra):

1. DevTools → Application → Manifest: carga sin errores, con los 3 íconos y los colores correctos.
2. Application → Service Workers: `sw.js` se registra y activa (`activated and running`).
3. Chrome muestra el ícono de "instalar" en la barra de direcciones (o `Application → Manifest → Installability` sin errores); instalar la app y confirmar que abre en modo standalone con el ícono de billetera.
4. Recargar una vez con red normal (para que el shell quede cacheado), luego simular offline (DevTools → Network → Offline) y recargar: la app debe seguir cargando y siendo usable.
5. En viewport móvil, confirmar que las metaetiquetas `apple-mobile-web-app-*` no rompen nada visualmente.
6. `npm run build && npm run preview`: repetir el chequeo de instalabilidad contra el build de producción, ya que los nombres de archivo con hash de Vite son los que realmente ejercitan la ruta de `stale-while-revalidate` del service worker.
