# Plan: Límite al autocomplete del buscador de historial

> Implementa [tasks/limite-autocomplete-busqueda-historial.md](../../tasks/limite-autocomplete-busqueda-historial.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

`computeHistorySuggestions` (usada para el `<datalist>` de texto libre del buscador de Historial, en `HistoryView`/`HistoryViewDesktop`) arma su lista recorriendo **todas** las transacciones y planes MSI del usuario sin límite, y las devuelve ordenadas alfabéticamente. Con miles de movimientos la lista crece sin tope, afectando la utilidad del autocomplete (sugerencias viejas ahogando a las relevantes).

Se confirmaron con el usuario las tres decisiones que la task dejaba abiertas:

- **Criterio de selección:** más reciente — por fecha de la transacción (`t.date`) / fecha de inicio del plan (`p.startDate`), no por frecuencia ni alfabético.
- **Alcance:** el límite aplica **solo** a `computeHistorySuggestions`. `computeKnownStores` queda sin cambios, porque además de alimentar los chips de `StoreInput` también alimenta el `<select>` "Todas las tiendas" del filtro de Historial — truncarlo ahí escondería tiendas viejas del filtro exacto, un caso de uso distinto al autocomplete de texto libre.
- **N:** 10.

Aclaración importante que surgió al revisar el plan: este límite solo afecta las sugerencias que el navegador muestra en el `<datalist>` mientras el usuario escribe. La búsqueda real (`filterHistoryTransactions`) compara el texto tecleado contra **todas** las transacciones directamente y no depende de `historySuggestions` en ningún punto — buscar algo que no esté en el top 10 de sugerencias sigue encontrando el resultado.

## Diseño

Se modificó `computeHistorySuggestions` en [hilo-finanzas.jsx](../../hilo-finanzas.jsx) para que, en vez de juntar un `Set` y ordenarlo alfabéticamente, calcule la fecha más reciente asociada a cada valor único (`store`/`description` de transacciones, `store`/`description` de planes MSI) y devuelva solo los N más recientes.

Sigue el mismo patrón de recencia que ya usa `computeRecentTxns` (`sort` por `date` con `localeCompare`, `createdAt` como desempate), para no introducir un criterio de ordenamiento nuevo en el archivo:

```js
export function computeHistorySuggestions(transactions, installmentPlans, limit = 10) {
  const latest = new Map(); // value -> [date, createdAt] más reciente visto
  const consider = (value, date, createdAt) => {
    if (!value) return;
    const stamp = [date || '', createdAt || 0];
    const prev = latest.get(value);
    if (!prev || stamp[0] > prev[0] || (stamp[0] === prev[0] && stamp[1] > prev[1])) {
      latest.set(value, stamp);
    }
  };
  transactions.forEach(t => {
    consider(t.store, t.date, t.createdAt);
    consider(t.description, t.date, t.createdAt);
  });
  installmentPlans.forEach(p => {
    consider(p.store, p.startDate, p.createdAt);
    consider(p.description, p.startDate, p.createdAt);
  });
  return Array.from(latest.entries())
    .sort((a, b) => b[1][0].localeCompare(a[1][0]) || b[1][1] - a[1][1])
    .slice(0, limit)
    .map(([value]) => value);
}
```

Notas de diseño:
- Si un mismo texto aparece como `store` en una transacción reciente y como `description` en una vieja, se queda con la fecha más reciente entre las dos apariciones.
- Registros sin `date`/`createdAt` caen al fondo de forma determinista (`''`/`0`), no rompen el sort — por la política de compatibilidad hacia atrás del repo no hay que asumir que siempre están presentes.
- No se toca `computeKnownStores` ni su firma — sigue devolviendo la lista completa ordenada alfabéticamente, usada por `StoreInput`, `InstallmentPlanPicker` y el `<select>` de filtro por tienda.
- No hizo falta memoización adicional en `App`: `historySuggestions` ya está detrás de un `useMemo(() => computeHistorySuggestions(transactions, installmentPlans), [transactions, installmentPlans])`, y sigue funcionando igual con la nueva firma (usa el default `limit = 10`).
- Los call sites que consumen `historySuggestions` (`HistoryView`, `HistoryViewDesktop`) no cambiaron — siguen mapeando el arreglo a `<option>` dentro del mismo `<datalist>`.

## Archivos tocados

- `hilo-finanzas.jsx` — nueva implementación de `computeHistorySuggestions`.
- `test/unit/domain.test.js` — se actualizó el test existente de `computeHistorySuggestions` (asumía orden alfabético sin límite) para reflejar el orden por recencia, y se agregó un caso que cubre el corte en `limit`.
- `tasks/limite-autocomplete-busqueda-historial.md` — `status: implementada`.
- `tasks/README.md` — fila de la tabla actualizada a "Implementada".

## Verificación

1. `npm test` — el test actualizado de `computeHistorySuggestions` pasa, junto con el resto de la suite (`filterHistoryTransactions` y los tests de integración de `HistoryView` no dependen del orden alfabético anterior).
2. `npm run dev` y en la vista de Historial (móvil y escritorio, `>=1024px`):
   - Crear más de 10 transacciones con `store`/`description` únicos y fechas distintas.
   - Abrir el buscador de texto y confirmar que el `<datalist>` (autocomplete nativo del navegador) ofrece como máximo 10 sugerencias, priorizando las más recientes.
   - Confirmar que el `<select>` "Todas las tiendas" del filtro sigue mostrando **todas** las tiendas conocidas, sin truncar.
