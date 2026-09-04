import { formatDateLabel } from './dates';

/** Agrupa por día en `[etiqueta, movimientos][]`, ya ordenado de más nuevo a más
 *  viejo (por fecha, y `createdAt` como desempate dentro del mismo día). */
export function groupByDate<T extends { date: string; createdAt?: number }>(
  list: readonly T[],
): Array<[string, T[]]> {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const groups: Array<[string, T[]]> = [];
  let currentLabel: string | null = null;
  let currentList: T[] | null = null;
  for (const t of sorted) {
    const label = formatDateLabel(t.date);
    // `currentList === null` solo puede darse en la primera vuelta, cuando
    // `currentLabel` también es null; está para que el tipo sea no-nulo abajo.
    if (label !== currentLabel || currentList === null) {
      currentLabel = label;
      currentList = [];
      groups.push([label, currentList]);
    }
    currentList.push(t);
  }
  return groups;
}
