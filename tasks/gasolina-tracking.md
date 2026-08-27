---
status: pendiente
priority: 15
---

# Caso especial para gastos de gasolina

Cuando el gasto es una carga de gasolina, queremos capturar unos datos extra para poder calcular el rendimiento del coche (cuánto nos rindió la gasolina) a lo largo del tiempo.

## Problema que resuelve

Hoy una carga de gasolina se registra como un `expense` normal: solo monto, comercio, categoría y fecha. Con eso no hay forma de saber cuántos kilómetros por litro está rindiendo el coche, ni de detectar si el rendimiento se está degradando.

## Idea a alto nivel

Detectar (o marcar explícitamente) que un gasto es de gasolina y, en ese caso, mostrar en `AddTransactionSheet` campos adicionales:

- **Monto** — ya existe, es la cantidad pagada.
- **Litros** cargados.
- **Nivel del tanque** al momento de cargar (a qué capacidad estaba: p. ej. 1/4, 1/2, en reserva, o un porcentaje).
- **Kilometraje** del coche (odómetro) al momento de la carga.

Con el kilometraje y los litros de cargas consecutivas se puede derivar el rendimiento (km recorridos entre litros de la carga anterior) sin guardarlo aparte, igual que hoy se derivan los saldos de cuenta.

## Dudas abiertas

- ¿Cómo se activa el caso especial? ¿Categoría "Gasolina" reservada, un tipo de gasto, o un toggle manual en la hoja?
- ¿Nivel del tanque como fracción fija, texto libre o slider de porcentaje?
- ¿Dónde se muestra el rendimiento calculado? ¿Vista propia, o dentro del detalle del movimiento / de la cuenta del coche?
- Si hay varios coches, habría que asociar la carga a un coche (¿cuenta, categoría, o campo nuevo?).
- Los campos nuevos deberían seguir la convención de los campos de producto (`size`/`brand`/`quantity`): opcionales, visibles solo al abrir/editar el movimiento, no en la fila compacta de Historial.
