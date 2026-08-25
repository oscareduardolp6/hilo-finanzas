---
status: implementada
priority: 1
---

# Visualización de escritorio

Hoy la app está diseñada como una vista móvil única: un contenedor centrado de `max-w-md` (ver el `App` en [hilo-finanzas.jsx](../hilo-finanzas.jsx)) con navegación inferior de pestañas. En pantallas grandes se ve como una tarjeta angosta flotando en medio de la pantalla, con mucho espacio vacío a los lados sin usar.

## Idea

Un layout alterno (o adaptativo) para pantallas de escritorio que aproveche el ancho disponible — por ejemplo panel de navegación lateral en vez de `BottomNav`, y quizás mostrar más de una vista a la vez (p. ej. cuentas + historial lado a lado).

## Resuelto

Implementado en [agents/plans/desktop-view.md](../agents/plans/desktop-view.md). Resumen de las decisiones que esta task dejaba abiertas:

- **Árbol de componentes separado** (no una versión responsive de las mismas funciones): `DesktopShell` + `DesktopSidebar` + `HomeViewDesktop`/`HistoryViewDesktop`/`AccountsViewDesktop`/`MsiViewDesktop`, montado por `App` vía un hook `useIsDesktop()` (breakpoint `lg`, 1024px) cuando la pantalla es ancha, en vez del árbol móvil `max-w-md` + `BottomNav`.
- Se mantienen las mismas 4 pestañas (una vista a la vez); cada vista de escritorio se rediseña internamente con grids multi-columna para mostrar más información, sin combinar pestañas ni cambiar el modelo de estado de filtros/selección.
