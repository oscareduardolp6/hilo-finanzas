/* La evolución del saldo total en el tiempo. Funciones puras: reciben cuentas y
   movimientos (más "hoy", inyectado para que sean deterministas) y devuelven la
   serie que pinta la gráfica.

   El saldo nunca se guarda (ver `accounts/domain/balance.ts`), así que el
   histórico se reconstruye plegando los movimientos: saldo inicial de las
   cuentas + ingresos − gastos. Las transferencias no mueven el total (salen de
   una cuenta y entran a otra, incluso las marcadas como gasto). No hace falta
   ningún campo nuevo ni migración. */

import type { Account, Transaction } from '../../../shared/domain/types';

export type EvolutionRangeId = '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | 'all';

export type EvolutionRange = {
  id: EvolutionRangeId;
  label: string;
  /** `null` = todo el historial. */
  months: number | null;
};

export const EVOLUTION_RANGES: EvolutionRange[] = [
  { id: '1m', label: '1M', months: 1 },
  { id: '3m', label: '3M', months: 3 },
  { id: '6m', label: '6M', months: 6 },
  { id: '1y', label: '1A', months: 12 },
  { id: '2y', label: '2A', months: 24 },
  { id: '3y', label: '3A', months: 36 },
  { id: 'all', label: 'Todo', months: null },
];

export const DEFAULT_EVOLUTION_RANGE: EvolutionRangeId = '6m';

/** Tope de puntos de la serie: más no se distinguen en una pantalla de 375px. */
const MAX_POINTS = 60;

export type BalancePoint = {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Saldo total al cierre de ese día. */
  balance: number;
};

export type BalanceSeries = {
  points: BalancePoint[];
  /** El saldo justo antes de que empiece el plazo. */
  startBalance: number;
  /** El saldo al cierre de hoy. */
  endBalance: number;
  /** `endBalance − startBalance`: lo que se ahorró (o perdió) en el plazo. */
  change: number;
  /** `null` cuando el saldo inicial es ≤ 0: un porcentaje sobre eso no dice nada. */
  changePct: number | null;
};

/* Los tipos de entrada son laxos a propósito: hay datos de versiones viejas
   donde `initialBalance` es un string o falta, y el código tiene que tolerar lo
   mismo que `computeAccountBalance`. */
type SeriesAccount = Pick<Account, 'id'> & { initialBalance?: unknown };

/* Aritmética de fechas sobre strings ISO, en calendario local y sin pasar por
   zonas horarias: `Date.UTC` evita que un cambio de horario mueva un día. */

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return { y, m, d };
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayNumber(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Resta meses de calendario; si el día no existe en el mes destino (31 de
 *  marzo − 1 mes) cae al último día de ese mes. */
export function subtractMonthsIso(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso);
  const total = y * 12 + (m - 1) - months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return toIso(ty, tm, Math.min(d, lastDay));
}

/** Cuánto mueve este movimiento el saldo total. */
function balanceDelta(t: Transaction): number {
  const amount = Number(t.amount) || 0;
  if (t.type === 'income') return amount;
  if (t.type === 'expense') return -amount;
  return 0;
}

export function computeBalanceSeries(
  accounts: SeriesAccount[],
  transactions: Transaction[],
  rangeId: EvolutionRangeId,
  today: string,
): BalanceSeries {
  const opening = accounts.reduce((s, a) => s + (Number(a.initialBalance) || 0), 0);

  // Lo futuro queda fuera: la serie termina hoy. Ordenado una sola vez para
  // recorrerlo con un puntero en vez de re-sumar por cada punto.
  const dated = transactions
    .filter((t) => typeof t.date === 'string' && t.date <= today)
    .map((t) => ({ date: t.date, delta: balanceDelta(t) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const range = EVOLUTION_RANGES.find((r) => r.id === rangeId) ?? EVOLUTION_RANGES[2]!;
  let start: string;
  if (range.months === null) start = dated.length ? dated[0]!.date : today;
  else start = subtractMonthsIso(today, range.months);

  let i = 0;
  let balance = opening;
  // La línea base: todo lo anterior al primer día del plazo.
  while (i < dated.length && dated[i]!.date < start) balance += dated[i++]!.delta;
  const startBalance = balance;

  const points: BalancePoint[] = [{ date: start, balance: startBalance }];
  const span = Math.max(0, dayNumber(today) - dayNumber(start));
  const step = Math.max(1, Math.ceil(span / MAX_POINTS));

  const cutoffs: string[] = [];
  for (let offset = step; offset < span; offset += step) cutoffs.push(addDays(start, offset));
  cutoffs.push(today);

  for (const cutoff of cutoffs) {
    while (i < dated.length && dated[i]!.date <= cutoff) balance += dated[i++]!.delta;
    points.push({ date: cutoff, balance });
  }

  const endBalance = balance;
  const change = endBalance - startBalance;
  return {
    points,
    startBalance,
    endBalance,
    change,
    changePct: startBalance > 0 ? (change / startBalance) * 100 : null,
  };
}
