---
status: pendiente
priority: 2
---

# Escaneo de tickets que genera un movimiento desglosado (y tickets de varias fotos)

Sigue a [cuentas-completas-tickets.md](cuentas-completas-tickets.md), que agregó el **desglose de un movimiento** (`breakdown` en un gasto o en una transferencia marcada como gasto: renglones con su propia categoría, y descuentos como ahorro ligable a un programa de beneficios). Esa iteración solo cubrió la captura manual; el escaneo de tickets ([receipt-ocr.md](receipt-ocr.md)) sigue funcionando como antes.

## Problema que resuelve

1. **El escaneo sigue generando N movimientos sueltos.** `addReceiptTransactions` ([src/features/receipt-ocr/application/add-receipt-transactions.ts](../src/features/receipt-ocr/application/add-receipt-transactions.ts)) crea una transacción por renglón más un `income` en "Descuentos" por cada descuento. Con el desglose ya existente, lo natural es que un ticket escaneado sea **un solo movimiento** por lo realmente pagado, con los renglones y descuentos adentro — una fila en el historial, el dinero movido una sola vez, y el descuento como ahorro (no como ingreso que infla el saldo).
2. **Los tickets largos no caben en una foto.** Un ticket de súper de 40 artículos hay que fotografiarlo en partes. Hoy el escaneo acepta una sola imagen.

## Idea a alto nivel

- **Varias fotos por ticket ("páginas").** En el paso de captura, poder agregar más de una imagen antes de mandar a reconocer, y mandarlas juntas al modelo en un solo request. Las fotos se traslapan, así que habrá renglones repetidos entre páginas: **se espera que el modelo de reconocimiento los deduplique** (instrucción explícita en el prompt), y la hoja de revisión sigue permitiendo quitar a mano lo que se le escape.
- **Salida = un movimiento desglosado.** Al confirmar, crear un gasto (o transferencia marcada como gasto si se pagó con tarjeta) con `amount` = total pagado y `breakdown` con un renglón por artículo (descripción, cantidad, precio unitario, total, categoría sugerida) y un descuento por cada descuento del ticket (con `BenefitProgramPicker` opcional en la revisión).
- La advertencia no bloqueante de "no cuadra con el total impreso" se mantiene; ahora "Sin especificar" absorbe la diferencia si los renglones suman menos.

## Dudas abiertas

- **Renglones a cuentas distintas.** Hoy la revisión permite mandar cada renglón a una cuenta diferente (y en modo transferencia por cuenta). Un movimiento desglosado tiene una sola cuenta. ¿Se elimina esa opción, o el escaneo genera un movimiento desglosado **por cuenta** usada?
- ¿Se conserva el modo actual (N movimientos + `income` en Descuentos) como alternativa, o se reemplaza del todo? Los movimientos ya guardados con el modo viejo no se tocan.
- Límite de imágenes por request y tamaño: comprimir cada página (`shared/infrastructure/image.ts`) y definir un máximo razonable.
- ¿El modelo debe devolver el total impreso por página o uno solo? Lo segundo es lo que importa para cuadrar.
