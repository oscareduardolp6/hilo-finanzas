/* Cuánto se ha ganado por programa de beneficios, DERIVADO (nunca se guarda):
   se deriva sumando los `income` que lo referencian, igual que
   `features/installments/domain/progress.ts` deriva el avance de un plan MSI
   sumando sus abonos en vez de guardar un contador.

   Un programa borrado deja de aparecer aquí (ya no está en `programs`), pero
   el `income` que lo referenciaba no se toca — mismo criterio que un plan MSI
   borrado: "borrar el plan no borra sus pagos" (save-plan.ts). */

import type { BenefitProgram, Transaction } from '../../../shared/domain/types';

export function computeBenefitTotals(
  transactions: Transaction[],
  programs: BenefitProgram[],
  sinceIso?: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of programs) totals[p.id] = 0;
  for (const t of transactions) {
    if (t.type !== 'income' || !t.benefitProgramId) continue;
    if (!(t.benefitProgramId in totals)) continue;
    if (sinceIso && t.date < sinceIso) continue;
    totals[t.benefitProgramId] = (totals[t.benefitProgramId] ?? 0) + t.amount;
  }
  return totals;
}
