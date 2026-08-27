---
status: pendiente
priority: 5
---

# Campos de producto en transferencias marcadas como gasto

Los campos nuevos de detalle de producto (`size`, `brand`, `quantity`, y en general el bloque de "cantidad, tamaño, marca, etc.") solo existen hoy en el `type: expense`. Cuando una transferencia se marca con `taggedAsExpense`, esos campos no se capturan ni se guardan.

## Problema que resuelve

Una transferencia marcada como gasto cuenta para los totales por categoría y aparece en los reportes de gasto igual que un `expense` normal (así se trackea el gasto con tarjeta de crédito sin doble conteo). Pero al no tener los campos de producto, ese gasto queda incompleto: no se le puede anotar marca, tamaño ni cantidad como a cualquier otro gasto.

## Idea a alto nivel

Cuando `taggedAsExpense` está activo en una transferencia, `AddTransactionSheet` debería mostrar el mismo bloque de campos de producto que muestra para un `expense`, y esos valores deberían persistirse en el objeto `transfer` y considerarse en cualquier lugar que ya lea `size`/`brand`/`quantity` de los expenses (detalle del movimiento, edición, y lo que aplique en reportes).

## Dudas abiertas

- Confirmar en el modelo de `transfer` qué campos habría que agregar y si conviene reutilizar los mismos nombres (`size`/`brand`/`quantity`) para que el código que los consume no tenga que ramificar por tipo.
- ¿Mostrar el bloque solo cuando `taggedAsExpense` está prendido, u ocultarlo/limpiarlo al apagarlo?
- Revisar la importación de Monefy con "Convención de Oscar": si un movimiento con campos separados por guion cae como transferencia-gasto, hoy probablemente se pierden esos campos.
