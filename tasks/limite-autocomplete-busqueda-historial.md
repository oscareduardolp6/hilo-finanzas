---
status: implementada
priority: 1
---

# Límite al autocomplete del buscador de historial

Poner un tope al número de sugerencias que arma el autocomplete (`<datalist>`) del buscador de [Historial](buscador-historial.md).

## Problema que resuelve

`computeHistorySuggestions` (y de forma similar `computeKnownStores`, usado en el picker de tienda de `AddTransactionSheet`/`MsiPlanModal`) arma su lista recorriendo **todas** las transacciones y planes MSI del usuario, sin ningún límite: junta cada `store`/`description` única de todo el historial y se la pasa entera al `<datalist>` nativo del input de búsqueda (`HistoryView`/`HistoryViewDesktop`, líneas ~1903 y ~2210 de [hilo-finanzas.jsx](../hilo-finanzas.jsx)). Conforme un usuario acumula más historial, esa lista crece sin tope — con miles de movimientos puede volverse una lista enorme, lo cual afecta el performance de recalcularla en cada render (`useMemo`, pero igual recalcula sobre todo el arreglo) y la utilidad real del autocomplete (sugerencias viejas o poco relevantes ahogando a las útiles).

## Idea a alto nivel

- Poner un límite razonable (p. ej. las N más recientes, o las N más frecuentes) al tamaño del arreglo que devuelve `computeHistorySuggestions`.
- Mantener el resultado determinista y estable entre renders para no generar saltos raros en el `<datalist>` mientras el usuario escribe.

## Dudas abiertas

- ¿Cuál es el criterio de "top N": más reciente (por fecha de transacción), más frecuente (repetido más veces), o simplemente un corte alfabético arbitrario? Más reciente o más frecuente son más útiles que un corte alfabético, pero requieren ordenar por algo más que el nombre antes de cortar.
- ¿El mismo límite aplica a `computeKnownStores` (usado en `StoreInput` para elegir tienda al crear/editar un movimiento), o solo al buscador de Historial? Son funciones separadas hoy pero con el mismo problema de fondo.
- ¿Qué valor de N tiene sentido? (¿50? ¿100?) — depende de qué tan usable se sienta el `<datalist>` nativo del navegador con esa cantidad de opciones.
