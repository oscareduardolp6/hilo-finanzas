---
status: implementada
priority: 2
---

# Escaneo de tickets que genera un movimiento desglosado (y tickets de varias fotos)

## Estado

Implementado (ver [agents/plans/ocr-ticket-desglosado.md](../agents/plans/ocr-ticket-desglosado.md)). Decisiones tomadas con el usuario:

- **La revisión es el formulario normal de "Nuevo movimiento"**, abierto ya lleno: total pagado, tienda, fecha, categoría dominante y el desglose activado con un renglón por artículo y los descuentos como ahorro. Una sola cuenta por ticket; si se pagó con tarjeta, se cambia a Transferencia y el desglose se conserva (queda marcada como gasto).
- **Se reemplazó el modo viejo** (N movimientos + `income` en "Descuentos"). Lo ya guardado con él no se toca.
- **Varias fotos por ticket** (hasta 8), con "Tomar foto" y "Elegir de la galería" por separado; van en un solo request, etiquetadas en orden, y el prompt le explica al modelo cómo alinear el traslape entre fotos para no repetir renglones. Si aun así se le escapa uno, el desglose no cuadra y el formulario no deja guardar hasta quitarlo.
- **Un solo total para todo el ticket** (no uno por foto).
- **Modelo por defecto `claude-haiku-5-5`** (lee las fotos a mayor resolución y cuesta menos); salida estructurada en vez de herramienta forzada.
- **El error "La clave de API no es válida" en el teléfono**: el campo de la key deja de ser de contraseña (el gestor del navegador podía pisarla), se puede mostrar, se limpian espacios e invisibles colados al pegar, y hay un botón "Probar clave" en Ajustes. Cada dispositivo guarda su propia key.

Las dudas de abajo quedaron resueltas así; se dejan como contexto.

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
