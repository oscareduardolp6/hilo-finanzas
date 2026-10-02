---
status: implementada
priority: 3
---

# Filtro por cuenta en el historial

Un desplegable "Todas las cuentas" en el Historial (móvil y escritorio) para ver solo los movimientos de una cuenta.

## Cómo funciona

- `filterAccount` es un campo efímero del `ui-slice` (`'all'` por defecto, no se persiste), igual que `filterType`/`filterCategory`/`filterStore`.
- `filterHistoryTransactions` ([src/features/history/domain/filters.ts](../src/features/history/domain/filters.ts)) lo compone con los demás filtros. Un gasto o ingreso entra por su `accountId`; una **transferencia entra por origen o destino** (`fromAccountId` / `toAccountId`), porque toca a las dos cuentas. El parámetro es opcional en el tipo (ausente = todas) para no tocar la suite de regresión.
- El desplegable ofrece todas las cuentas, en `HistoryView` (ancho completo sobre categoría/tienda) y en `HistoryViewDesktop` (en la barra de filtros).

## Fuera de alcance

- Mostrar el saldo de la cuenta filtrada o un total del filtro.
- Que el filtro de cuenta se limpie al salir del Historial (como los otros filtros, se queda hasta recargar).
