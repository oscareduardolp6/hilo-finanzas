# Plan: Límite al autocomplete del buscador de historial

> Implementa [tasks/limite-autocomplete-busqueda-historial.md](../../tasks/limite-autocomplete-busqueda-historial.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

`computeHistorySuggestions` (usada para el `<datalist>` de texto libre del buscador de Historial) arma su lista recorriendo **todas** las transacciones y planes MSI del usuario sin límite, y las devuelve ordenadas alfabéticamente. Con miles de movimientos la lista crece sin tope, afectando la utilidad del autocomplete (sugerencias viejas ahogando a las relevantes).

Este mismo cambio ya se implementó y aprobó en `master` (ver el commit `ee2ac71`, "Cap history search autocomplete to 10 most recent suggestions"), cuando `hilo-finanzas.jsx` todavía era el único archivo del producto. Esta rama (`refactor`) ya completó la migración a arquitectura en capas ([tasks/layered-architecture.md](../../tasks/layered-architecture.md) / [agents/plans/layered-architecture.md](layered-architecture.md)), así que `computeHistorySuggestions` ahora vive en `src/features/history/domain/filters.ts`. Este plan reutiliza las mismas decisiones ya confirmadas con el usuario, aplicadas a la ubicación nueva:

- **Criterio de selección:** más reciente — por fecha de la transacción (`t.date`) / fecha de inicio del plan (`p.startDate`), no por frecuencia ni alfabético.
- **Alcance:** el límite aplica **solo** a `computeHistorySuggestions`. `computeKnownStores` (ahora en `src/features/transactions/domain/queries.ts`) queda sin cambios, porque además de alimentar los chips de `StoreInput` también alimenta el `<select>` "Todas las tiendas" del filtro de Historial — truncarlo ahí escondería tiendas viejas del filtro exacto, un caso de uso distinto al autocomplete de texto libre.
- **N:** 10.
- Este límite solo afecta las sugerencias del `<datalist>` mientras el usuario escribe. La búsqueda real (`filterHistoryTransactions`, en el mismo archivo) compara el texto tecleado contra **todas** las transacciones directamente y no depende de `historySuggestions` en ningún punto.

## Diseño

Se modificó `computeHistorySuggestions` en [src/features/history/domain/filters.ts](../../src/features/history/domain/filters.ts) para que, en vez de juntar un `Set` y ordenarlo alfabéticamente, calcule la fecha más reciente asociada a cada valor único (`store`/`description` de transacciones, `store`/`description` de planes MSI) y devuelva solo los N más recientes — mismo algoritmo que en `master`, adaptado a TypeScript y al patrón de acceso laxo (`loose(t)`) que ya usa este archivo para tolerar registros guardados por versiones anteriores del tipo `Transaction`:

```ts
export function computeHistorySuggestions(
  transactions: Transaction[],
  installmentPlans: InstallmentPlan[],
  limit = 10,
): string[] {
  const latest = new Map<string, [string, number]>(); // valor -> [fecha, createdAt] más reciente visto
  const consider = (value: string | null | undefined, date: string | undefined, createdAt: number | undefined) => {
    if (!value) return;
    const stamp: [string, number] = [date || '', createdAt || 0];
    const prev = latest.get(value);
    if (!prev || stamp[0] > prev[0] || (stamp[0] === prev[0] && stamp[1] > prev[1])) {
      latest.set(value, stamp);
    }
  };
  transactions.forEach(t => {
    const x = loose(t);
    consider(x.store, t.date, t.createdAt);
    consider(x.description, t.date, t.createdAt);
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

Sigue el mismo patrón de recencia que ya usa `computeRecentTxns` en `src/features/transactions/domain/queries.ts` (`sort` por `date` con `localeCompare`, `createdAt` como desempate).

Notas de diseño:
- `t.date` y `t.createdAt` se leen directamente del `Transaction` (son comunes a los tres miembros de la unión vía `TransactionBase`/`Stamped`); `store`/`description` siguen leyéndose vía `loose(t)` como ya hacía el resto del archivo, por si hay datos guardados que no calzan estrictamente con la unión de tipos.
- No se tocó `computeKnownStores` ni su firma en `src/features/transactions/domain/queries.ts`.
- No hizo falta memoización adicional — quien consuma `historySuggestions` (los containers/vistas de Historial) sigue llamando la función con la misma firma, usando el default `limit = 10`.

## Archivos tocados

- `src/features/history/domain/filters.ts` — nueva implementación de `computeHistorySuggestions`.
- `src/features/history/domain/filters.test.ts` — se actualizó el test existente (asumía orden alfabético sin límite) para reflejar el orden por recencia, y se agregaron casos que cubren: valor repetido en distintos campos/fechas, el corte al límite default, y un límite explícito.
- `test/unit/domain.test.js` — suite heredada de antes del refactor (importa todo desde el barrel `hilo-finanzas.jsx`); se actualizó el mismo `describe('computeHistorySuggestions', ...)` en paralelo al de `filters.test.ts`, porque también ejercía el comportamiento alfabético anterior.
- `tasks/limite-autocomplete-busqueda-historial.md` — `status: implementada`.
- `tasks/README.md` — fila de la tabla actualizada a "Implementada".

## Verificación

1. `npm install` — esta rama agrega `fp-ts` como dependencia nueva; si `node_modules` viene de instalar sobre `master`, `npm test`/`npm run typecheck` fallan por el import faltante hasta reinstalar.
2. `npm test` — las 427 pruebas de la suite pasan, incluyendo `filters.test.ts` y `test/unit/domain.test.js`.
3. `npm run typecheck` — sin errores de tipos.
4. (Opcional, manual) `npm run dev`, ir a Historial con más de 10 tiendas/descripciones únicas y confirmar que el `<datalist>` ofrece como máximo 10 sugerencias priorizando las más recientes, y que el `<select>` "Todas las tiendas" sigue mostrando todas sin truncar — ya verificado en `master` sobre la misma lógica; no se repitió manualmente en esta rama porque el algoritmo y sus pruebas unitarias son idénticos.
