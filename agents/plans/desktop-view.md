# Plan: Visualización de escritorio para Hilo

> Implementa [tasks/desktop-view.md](../../tasks/desktop-view.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

[tasks/desktop-view.md](../../tasks/desktop-view.md) señala que Hilo solo tenía una vista móvil (`max-w-md`, `BottomNav`) que se veía como una tarjeta angosta flotando en pantallas grandes, con mucho espacio vacío sin usar. Se pidió un layout de escritorio que **no sea la misma vista escalada**: debe aprovechar el espacio extra mostrando más información, mientras la vista móvil permanece exactamente como estaba.

Se confirmaron con el usuario las dos decisiones que la task dejaba abiertas:

1. **Árbol de componentes separado**, no una versión "responsive" de las mismas funciones — para minimizar el riesgo de romper la vista móvil actual, y porque el layout de escritorio es genuinamente distinto (sidebar, grids, modales centrados) en vez de una variación de anchos.
2. **Se mantienen las mismas 4 pestañas** (Inicio / Historial / MSI / Cuentas) navegadas una a la vez — no se combinan vistas lado a lado. Cada vista de escritorio se rediseña internamente (grids multi-columna) para mostrar más información sin cambiar el modelo de estado de filtros/selección.

Todo el trabajo sigue viviendo en **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)** — CLAUDE.md establece que la app es un componente único autocontenido, publicable como Claude Artifact, y eso requiere un solo archivo. "Separado" se logra con una sección de componentes claramente distinta dentro del mismo archivo (`DesktopShell`, `DesktopSidebar`, `HomeViewDesktop`, etc.), no con un archivo nuevo.

## Diseño

### Detección de breakpoint

Hook `useIsDesktop()` (helpers), basado en `window.matchMedia('(min-width: 1024px)')` — 1024px es el breakpoint `lg` de Tailwind.

### App: ramificación sin tocar el árbol móvil

`App` ya calcula todo el estado y los `useMemo` derivados que necesitan ambas vistas. El cambio es un **early return** justo antes del `return (` móvil: si `isDesktop`, renderiza `<DesktopShell />` con el mismo conjunto de props que hoy recibe el árbol móvil (vistas + estado/handlers de los 4 modales + toast). El JSX móvil no se modifica — cero riesgo de regresión visual ahí.

### Reuso: `NAV_ITEMS` compartido

El array de 4 pestañas de `BottomNav` se extrae a una constante de nivel superior `NAV_ITEMS`, consumida tanto por `BottomNav` como por el nuevo `DesktopSidebar`.

### Componentes nuevos (bloque "DESKTOP VIEWS" separado en el archivo)

- **`DesktopShell`** — layout raíz `h-screen w-full flex`: `DesktopSidebar` fijo a la izquierda + área principal `flex-1 overflow-y-auto` (`max-w-6xl mx-auto p-8`) con header contextual (título de pestaña, pager de mes, botón "Nueva transacción" reemplazando al FAB) y la vista de escritorio activa. Renderiza los mismos 4 modales que `App`, pasándoles `desktop`.
- **`DesktopSidebar`** — nav vertical con `NAV_ITEMS`, título "Hilo" y botón de ajustes.
- **`HomeViewDesktop`** — grid de 2 columnas: principal (balance + `ExpenseDonut` + transacciones recientes), lateral (cuentas en grid de tarjetas, preview de MSI activos). Reutiliza `ExpenseDonut`, `TransactionRow`, `MsiPlanCard`.
- **`HistoryViewDesktop`** — filtros en una barra horizontal (no apilados), lista agrupada por fecha reutilizando `groupByDate`/`TransactionRow`.
- **`AccountsViewDesktop`** — grid de tarjetas de cuenta en vez de lista vertical.
- **`MsiViewDesktop`** — grid de `MsiPlanCard` (activos/pagados) en vez de listas apiladas.

Todas reciben las mismas firmas de props que sus contrapartes móviles.

### Modales y overlays en escritorio

`SheetOverlay` gana un prop `desktop`: en `false` (default) sin cambios; en `true`, `fixed inset-0 ... items-center justify-center` con hoja `max-w-lg w-full rounded-3xl` (modal centrado, no bottom-sheet). Los 4 modales pasan `desktop` hacia su `SheetOverlay` sin cambiar lógica interna. `Toast` gana el mismo prop para posicionarse `fixed bottom-6 right-6` en vez de `absolute left-5 right-5`. Sin FAB en escritorio — el botón vive en el header de `DesktopShell`.

## Archivos tocados

1. **`hilo-finanzas.jsx`** — hook `useIsDesktop`, `NAV_ITEMS` compartido, prop `desktop` en `SheetOverlay`/`Toast`, bloque nuevo de componentes de escritorio, early return en `App`.
2. **`CLAUDE.md`** — nota de arquitectura sobre el árbol de escritorio paralelo + sección de sincronización specs/código.
3. **`tasks/desktop-view.md`** — `status: implementada`.
4. **`tasks/README.md`** — fila de la tabla actualizada.

## Verificación

1. `npm run dev`, abrir en navegador.
2. Ventana angosta (< 1024px): la app se ve idéntica a antes del cambio.
3. Ventana ancha (≥ 1024px): sidebar en vez de `BottomNav`; cada pestaña usa su layout de escritorio.
4. Los 4 modales en modo escritorio aparecen centrados y funcionan igual que en móvil.
5. Cruzar el breakpoint en vivo no rompe estado (pestaña, filtros, mes).
6. Sin errores de consola en ningún modo.

## Estado post-implementación

_(Actualizar esta sección si algo se implementó distinto a lo descrito arriba — ver la nota de sincronización en CLAUDE.md.)_

Implementado tal como se describe en este plan.
