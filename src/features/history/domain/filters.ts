/* El filtro del historial: mes / todo-el-tiempo, tipo, categoría, tienda y
   búsqueda de texto. Los cinco se componen, y el orden importa poco salvo por
   uno: **mientras hay búsqueda, el filtro de mes no se aplica**. Buscar es
   siempre en todo el tiempo; si no, el resultado dependería de en qué mes
   estabas parado cuando empezaste a escribir. */

import { monthKey } from '../../../shared/domain/dates';
import { normalizeForSearch } from '../../../shared/domain/search';
import type { InstallmentPlan, Transaction } from '../../../shared/domain/types';

/** `'msi'` no es un `type` de movimiento: es "tiene plan MSI vinculado", y por
 *  eso se filtra distinto que los otros tres. */
export type HistoryFilterType = 'all' | 'expense' | 'income' | 'transfer' | 'msi';

export const HISTORY_TYPE_FILTERS: { id: HistoryFilterType; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'expense', label: 'Gastos' },
  { id: 'income', label: 'Ingresos' },
  { id: 'transfer', label: 'Transferencias' },
  { id: 'msi', label: 'MSI' },
];

export type HistoryFilter = {
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  showAllTime: boolean;
  searching: boolean;
  /** Ya normalizado con `normalizeForSearch` y sin espacios alrededor. */
  q: string;
  monthCursor: Date;
  filterType: string;
  filterCategory: string;
  filterStore: string;
};

/* Los campos se leen con acceso laxo por la misma razón de siempre: hay
   registros guardados por versiones anteriores cuyas combinaciones la unión de
   tipos ya no admite, y perder uno aquí sería esconder un movimiento del
   usuario. */
type LooseTransaction = {
  date?: string;
  type?: string;
  store?: string | null;
  description?: string | null;
  categoryId?: string | null;
  taggedAsExpense?: boolean;
  installmentPlanId?: string | null;
};

const loose = (t: Transaction): LooseTransaction => t as LooseTransaction;

export function filterHistoryTransactions({
  transactions, installmentPlans, showAllTime, searching, q, monthCursor,
  filterType, filterCategory, filterStore,
}: HistoryFilter): Transaction[] {
  let list = transactions;
  if (!showAllTime && !searching) {
    const key = monthKey(monthCursor);
    list = list.filter(t => t.date && t.date.startsWith(key));
  }
  if (filterType === 'msi') list = list.filter(t => !!loose(t).installmentPlanId);
  else if (filterType !== 'all') list = list.filter(t => t.type === filterType);
  if (filterCategory !== 'all') {
    list = list.filter(t => {
      const x = loose(t);
      return (
        (x.type === 'expense' && x.categoryId === filterCategory) ||
        (x.type === 'income' && x.categoryId === filterCategory) ||
        // Una transferencia solo entra por categoría si cuenta como gasto.
        (x.type === 'transfer' && !!x.taggedAsExpense && x.categoryId === filterCategory)
      );
    });
  }
  if (filterStore !== 'all') list = list.filter(t => loose(t).store === filterStore);
  if (searching) {
    list = list.filter(t => {
      const x = loose(t);
      const plan = x.installmentPlanId ? installmentPlans.find(p => p.id === x.installmentPlanId) : null;
      // El plan vinculado entra en la búsqueda: un abono de MSI se encuentra por
      // el nombre de la compra, aunque su propia descripción no lo diga.
      const hay = [x.description, x.store, plan && plan.description, plan && plan.store]
        .map(normalizeForSearch)
        .join(' ');
      return hay.includes(q);
    });
  }
  return list;
}

/** Lo que ofrece el `<datalist>` del buscador: las `limit` tiendas/descripciones
 *  usadas más recientemente (movimientos y planes incluidos), no todo el
 *  historial — sin tope la lista crece para siempre y ahoga lo relevante con
 *  sugerencias viejas. Sigue el mismo criterio de recencia que
 *  `computeRecentTxns` (fecha, `createdAt` como desempate). */
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
