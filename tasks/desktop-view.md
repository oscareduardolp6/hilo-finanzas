---
status: pendiente
priority: 1
---

# Visualización de escritorio

Hoy la app está diseñada como una vista móvil única: un contenedor centrado de `max-w-md` (ver el `App` en [hilo-finanzas.jsx](../hilo-finanzas.jsx)) con navegación inferior de pestañas. En pantallas grandes se ve como una tarjeta angosta flotando en medio de la pantalla, con mucho espacio vacío a los lados sin usar.

## Idea

Un layout alterno (o adaptativo) para pantallas de escritorio que aproveche el ancho disponible — por ejemplo panel de navegación lateral en vez de `BottomNav`, y quizás mostrar más de una vista a la vez (p. ej. cuentas + historial lado a lado).

## Abierto / por decidir

- ¿Un layout responsive dentro del mismo componente, o una vista de escritorio separada?
- Qué tanto de la estructura actual (una vista a la vez por pestaña) se mantiene vs. se rediseña para aprovechar el espacio horizontal.
