/* Consultas puras sobre la colección de movimientos. Las usan varias features
   (Inicio para el mes en curso, el historial para las sugerencias), y por eso
   viven en `domain/`: importarlas entre features está permitido, importar su
   `ui/` no. */

import type { InstallmentPlan, Transaction } from '../../../shared/domain/types';

/** Los movimientos de un mes. `periodKey` es `YYYY-MM`: prefix match sobre la
 *  fecha ISO, que es justo por lo que las fechas se guardan como string. */
export function computePeriodTransactions(transactions: Transaction[], periodKey: string): Transaction[] {
  return transactions.filter(t => t.date && t.date.startsWith(periodKey));
}

/** Los más recientes del periodo. Desempata por `createdAt` porque varios
 *  movimientos comparten fecha (la fecha no tiene hora). */
export function computeRecentTxns(periodTransactions: Transaction[], limit = 5): Transaction[] {
  return [...periodTransactions]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

/** Las tiendas ya usadas, para ofrecerlas como chips en `StoreInput`. */
export function computeKnownStores(transactions: Transaction[], installmentPlans: InstallmentPlan[]): string[] {
  const set = new Set<string>();
  transactions.forEach(t => { if ('store' in t && t.store) set.add(t.store); });
  installmentPlans.forEach(p => { if (p.store) set.add(p.store); });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
