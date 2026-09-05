---
status: pendiente
priority: 14
---

# Flujo para "consolidar" gastos pendientes de transferencia

Un flujo que vaya "cargando" gastos que el usuario ya hizo (p. ej. con tarjeta de crédito) pero que todavía no transfiere/concilia en Hilo, y que después ofrezca consolidarlos de un jalón, diciendo cuánto transferir a cada cuenta según las convenciones del usuario.

## Problema que resuelve

Un gasto con tarjeta de crédito genera una notificación del banco casi al instante, pero el usuario no siempre lo registra ni transfiere el pago correspondiente en Hilo de inmediato. Hoy no hay ningún concepto de "gasto pendiente de conciliar" — o se captura en el momento, o se le olvida y se pierde el registro (o se hace después de memoria, con margen de error).

## Idea a alto nivel

- Ir acumulando gastos "pendientes" (detectados de alguna fuente, o capturados manualmente como pendientes) que la app sabe que aún no se han pagado/transferido entre cuentas.
- Un flujo de "consolidación" que junte esos pendientes y le diga al usuario cuánto tiene que transferir a cada cuenta, aplicando sus convenciones (p. ej. "los gastos de la categoría X con la tarjeta Y se pagan desde la cuenta Z").
- Encaja con el modelo ya existente de `transfer` con `taggedAsExpense` — la consolidación probablemente termina creando esos transfers directamente.

## Dudas abiertas

- La fuente más natural de "gastos detectados automáticamente" serían las notificaciones del teléfono (banco, tarjeta), pero **leer notificaciones del sistema operativo no es viable desde una PWA/web app** — esto depende de [app-movil-nativa.md](app-movil-nativa.md), o de que el usuario capture el "pendiente" a mano (menos automático, pero factible con la arquitectura de hoy).
- ¿Cómo se definen y almacenan las "convenciones" de a qué cuenta transferir cada tipo de gasto? (¿reglas por categoría, por comercio, por cuenta de origen?)
- ¿Qué pasa con un gasto pendiente que no calza ninguna convención — se le pregunta al usuario en el momento de consolidar?
- ¿La consolidación es un paso manual que el usuario dispara cuando quiere, o hay algún recordatorio/notificación de la propia app cuando se acumulan pendientes?
