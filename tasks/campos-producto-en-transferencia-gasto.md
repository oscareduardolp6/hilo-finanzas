---
status: implementada
priority: 5
---

# Campos de producto en transferencias marcadas como gasto

Los campos nuevos de detalle de producto (`size`, `brand`, `quantity`, y en general el bloque de "cantidad, tamaño, marca, etc.") solo existen hoy en el `type: expense`. Cuando una transferencia se marca con `taggedAsExpense`, esos campos no se capturan ni se guardan.

## Problema que resuelve

Una transferencia marcada como gasto cuenta para los totales por categoría y aparece en los reportes de gasto igual que un `expense` normal (así se trackea el gasto con tarjeta de crédito sin doble conteo). Pero al no tener los campos de producto, ese gasto queda incompleto: no se le puede anotar marca, tamaño ni cantidad como a cualquier otro gasto.

## Idea a alto nivel

Cuando `taggedAsExpense` está activo en una transferencia, `AddTransactionSheet` debería mostrar el mismo bloque de campos de producto que muestra para un `expense`, y esos valores deberían persistirse en el objeto `transfer` y considerarse en cualquier lugar que ya lea `size`/`brand`/`quantity` de los expenses (detalle del movimiento, edición, y lo que aplique en reportes).

## Cómo quedó (implementada)

Ver [agents/plans/campos-producto-en-transferencia-gasto.md](../agents/plans/campos-producto-en-transferencia-gasto.md). En resumen:

- Se reutilizan los mismos nombres `size` / `brand` / `quantity` en el objeto `transfer`, así que el único consumidor (la propia hoja al editar, que ya lee `form.size` sin ramificar por tipo) no cambió.
- El bloque "Tamaño / Marca / Cantidad" se muestra siempre que `taggedAsExpense` esté activo, **incluyendo el sub-modo "Pago de MSI"** (decisión del usuario; el campo Comercio sigue siendo solo de "Gasto único"). Al apagar el tag, el bloque se oculta y al guardar los tres campos quedan en `null`.
- **Monefy no necesitó cambios:** los movimientos con campos separados por guion siempre se importan como `type: 'expense'` (que ya soporta esos campos); la rama de transferencias del import fija `taggedAsExpense: false` y no toca `oscarParsed`, así que el camino "guion → transferencia-gasto" no existe hoy.
