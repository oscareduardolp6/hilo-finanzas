---
status: pendiente
priority: 7
---

# Validar quién pagaría por la app

Un mecanismo de bajo compromiso para medir si hay gente dispuesta a pagar por Hilo, antes de invertir en construir cualquier mecanismo de cobro real.

## Problema que resuelve

Si en algún momento se quiere capitalizar la app, primero hay que saber si existe demanda real de pago, sin comprometerse de entrada a construir planes, cobros, o un modelo de negocio completo. Hoy no hay ninguna señal al respecto.

## Idea a alto nivel

- Algo ligero que mida *interés* en pagar, no que cobre de verdad todavía: por ejemplo, un botón tipo "Hazte Pro" que solo registra el click/interés, una encuesta corta dentro de la app, o una lista de espera para features premium hipotéticos.
- Depende de tener [analiticas-web.md](analiticas-web.md) resuelto primero, para poder medir cuánta gente ve la propuesta y cuánta muestra interés.
- No implica implementar cobros reales en esta etapa — es explícitamente un experimento de validación, no el lanzamiento de un plan de pago.

## Dudas abiertas

- ¿Qué canal usar para medir interés (banner dentro de la app, encuesta, waitlist externa)?
- ¿Qué features "premium" hipotéticos se probarían primero? (¿sync automático sin QR, más historial, soporte prioritario, algo del reconocimiento de tickets?)
- Una waitlist o cualquier mecanismo de pago real eventualmente necesitaría algún servicio externo (backend de terceros, procesador de pagos) — habría que decidir cómo se concilia eso con el enfoque actual de "client-only, sin backend propio" (ver [CLAUDE.md](../CLAUDE.md)).
