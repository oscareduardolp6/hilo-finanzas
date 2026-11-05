---
status: pendiente
priority: 21
---

# Aplicación móvil nativa (más allá de PWA)

Evaluar pasar de "PWA instalable" a tener también una app móvil real (iOS/Android), es decir, mudar la aplicación a nativo (o a un wrapper nativo). Prioridad baja a propósito: no se hace por sí misma, sino cuando alguna de las tareas que habilita lo justifique.

## Problema que resuelve

Hoy Hilo se instala como PWA (ver [pwa-install.md](pwa-install.md)), lo cual cubre bastante pero tiene límites: no hay acceso a ciertas integraciones del sistema (notificaciones push reales, tiles de acceso rápido, lectura de notificaciones del sistema, distribución en las tiendas de apps). Una app nativa abriría esas posibilidades, pero también trae otros retos: mantenimiento de otro target de build (o un wrapper), distribución en stores, y la relación entre el storage nativo y el IndexedDB que usa la app hoy.

## Idea a alto nivel

- Evaluar el approach: un wrapper tipo Capacitor (reutilizando `hilo-finanzas.jsx` casi tal cual) vs. una reescritura nativa completa.
- Justifica su prioridad principalmente porque **habilita otras tareas del backlog** que hoy no son viables como PWA: ver [acceso-rapido-android.md](acceso-rapido-android.md) , [consolidar-gastos-pendientes.md](consolidar-gastos-pendientes.md) y [gastos-desde-notificaciones.md](gastos-desde-notificaciones.md) (lectura de notificaciones del sistema).

## Dudas abiertas

- ¿Qué gana realmente sobre la PWA instalada, en concreto? (push notifications, tile de quick settings, deep links, lectura de notificaciones).
- ¿Vale la pena mantener dos targets de build (web + nativo) por ese beneficio, o conviene esperar a tener más claridad de qué features realmente lo necesitan?
- Si es un wrapper, ¿cómo convive con el modelo actual de "todo vive en un solo archivo `hilo-finanzas.jsx`"?
- Costos de cuentas de desarrollador (Apple/Google) y de mantenimiento continuo de la distribución en stores.
