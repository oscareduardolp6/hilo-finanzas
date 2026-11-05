/* Lecturas mínimas del desglose de un movimiento. Viven en `shared/` y no en
   `features/transactions/domain/breakdown.ts` (donde está el resto) porque las
   necesita `TransactionRow`, que es de `shared/ui` y no puede importar de una
   feature. */

import type { Transaction, TransactionBreakdown } from './types';

/** El desglose de un movimiento, si lo tiene. Lectura laxa: el campo puede
 *  no existir (registros viejos) y solo gasto/transferencia lo llevan. */
export function getBreakdown(t: Transaction): TransactionBreakdown | null {
  if (t.type === 'income') return null;
  const b = t.breakdown;
  if (!b) return null;
  return { items: Array.isArray(b.items) ? b.items : [], discounts: Array.isArray(b.discounts) ? b.discounts : [] };
}

/** Cuánto se ahorró en este movimiento (Σ descuentos del desglose). */
export function computeTransactionSavings(t: Transaction): number {
  const b = getBreakdown(t);
  return b ? b.discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0) : 0;
}
