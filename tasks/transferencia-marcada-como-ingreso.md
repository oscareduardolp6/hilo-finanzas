---
status: pendiente
priority: 5
---

# Transferencias marcables como ingreso (beneficios de promociones)

Hoy una transferencia se puede marcar `taggedAsExpense` para que cuente en los totales por categoría sin restar dos veces de `totalBalance`. Falta el espejo: poder marcarla como **ingreso**, para los casos en que una promoción "revierte" (total o parcialmente) lo que se pagó con una transferencia, y poder trackear ese ahorro como beneficio de su promoción.

## Problema que resuelve

Con promociones tipo "paga con tal tarjeta y te bonifican X%" o "te regresan $200 en tu estado de cuenta", el efecto real es que parte de una transferencia (típicamente "pago de tarjeta") se revierte: ese dinero no sale de verdad. Hoy no hay forma de capturarlo sin hacer un `income` aparte contra una cuenta, lo cual **sí** movería `totalBalance` y duplicaría el efecto (la transferencia ya refleja el pago neto en las cuentas). Resultado: el ahorro no queda registrado, o se registra mal y descuadra saldos.

## Idea a alto nivel

- Agregar a `transfer` un marcador `taggedAsIncome`, simétrico a `taggedAsExpense`: la transferencia **cuenta como ingreso** en reportes/totales por categoría y en el resumen de beneficios, pero **no suma a `totalBalance`** (el dinero ya se movió como transferencia; no hay entrada nueva a ninguna cuenta).
- Al activarlo, `AddTransactionSheet` pide una categoría de tipo `income` (p. ej. `Descuentos`) y el selector de programa de beneficio (`BenefitProgramPicker`), igual que ya hace para un `income` normal. El resultado: `benefitProgramId` en la transferencia.
- `computeBenefitTotals` ([src/features/benefits/domain/totals.ts](../src/features/benefits/domain/totals.ts)) hoy suma solo `income` con `benefitProgramId`; debe sumar también las transferencias `taggedAsIncome` con ese `benefitProgramId`, para que el ahorro aparezca en el resumen de "Beneficios y promociones".
- Los totales de ingresos del dashboard/historial ([src/features/dashboard/domain/totals.ts](../src/features/dashboard/domain/totals.ts), [src/features/history/domain/filters.ts](../src/features/history/domain/filters.ts)) y `TransactionRow` deben tratar la transferencia marcada como ingreso como se hace hoy con la marcada como gasto (badge/estilo distinto, entra en filtros por tipo/categoría).

## Compatibilidad con datos guardados

- `taggedAsIncome` (y cualquier campo nuevo) debe ser **opcional y tolerar ausencia**: las transferencias existentes no lo tienen y deben leerse como `false`. Nada de cambiar el significado de `taggedAsExpense` ni de `categoryId` en sitio.
- `normalizeExportPayload` / `replaceDataState` deben aceptar respaldos viejos sin el campo.

## Dudas abiertas

- **¿Excluyente con `taggedAsExpense`?** Una transferencia que es a la vez gasto e ingreso (compra de $1000 con bonificación de $150) es plausible, pero comparte hoy `categoryId` (de tipo expense). Propuesta: en la primera versión que sean mutuamente excluyentes y que el caso "gasto + bonificación" se capture como la transferencia-gasto más una segunda transferencia-ingreso por el monto bonificado. Si se quiere permitir ambos, hace falta un segundo campo de categoría (p. ej. `incomeCategoryId`).
- **¿Qué monto cuenta como ingreso?** Si la promo revierte solo una parte de la transferencia, ¿el ingreso es el `amount` completo de la transferencia o el usuario captura aparte el monto revertido? Lo más limpio: la transferencia-ingreso es una transferencia **propia** por el monto bonificado (no se marca la de pago original), así `amount` ya es el monto del beneficio y no hace falta un campo extra.
- **¿Cuentas origen/destino?** Una reversión fluye en sentido contrario al pago (de la tarjeta a la cuenta de débito, o simplemente "baja" la deuda de la tarjeta). Verificar que el formulario de transferencia existente cubre el sentido que el usuario necesita sin forzar cuentas ficticias.
- ¿El `Toast`/etiqueta en el historial debe distinguir visualmente "transferencia · ingreso" de "transferencia · gasto"?
- Importadores (`monefy-import`, `receipt-ocr`) hoy fijan `taggedAsExpense: false` en sus transferencias; basta con que también dejen `taggedAsIncome` ausente/`false`. Confirmar que no hay que cambiar nada más ahí.

## Pasos de implementación (cuando se tome)

Siguiendo la skill `implementar-tarea`: plan en `agents/plans/transferencia-marcada-como-ingreso.md`, tests nuevos junto a la feature (casos de uso y `AddTransactionSheet` vía `renderFeature`), y al terminar actualizar `status` aquí y la tabla de [tasks/README.md](README.md). Actualizar también la descripción de `transfer` y de `benefitProgramId` en `CLAUDE.md`.
