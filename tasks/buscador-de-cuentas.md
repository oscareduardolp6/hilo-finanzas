---
status: pendiente
priority: 9
---

# Buscador de cuentas

Agregar un buscador (filtro por texto) de cuentas para encontrarlas más rápido cuando la lista es larga.

## Problema que resuelve

A medida que crecen las cuentas (bancos, tarjetas, efectivo, ahorros, etc.), scrollear la lista para encontrar una en la vista de Cuentas —o en los selectores de cuenta de `AddTransactionSheet`— se vuelve lento.

## Idea a alto nivel

Un input de búsqueda que filtre las cuentas por nombre (y quizá por tipo) conforme se escribe. Como mínimo en `AccountsView` / `AccountsViewDesktop`; idealmente también en los pickers de cuenta al capturar un movimiento.

## Dudas abiertas

- ¿Mostrar el buscador siempre, o solo cuando hay más de N cuentas?
- ¿Filtrar solo por nombre o también por `type`?
- En los selectores de la hoja de captura, ¿basta con filtrar la lista o conviene un combobox con búsqueda?
