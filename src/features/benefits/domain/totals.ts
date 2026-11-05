/* Cuánto se ha ganado por programa de beneficios, DERIVADO (nunca se guarda):
   se deriva sumando los `income` que lo referencian — y los descuentos del
   desglose de un movimiento que lo referencian (ahorro, no ingreso) —, igual que
   `features/installments/domain/progress.ts` deriva el avance de un plan MSI
   sumando sus abonos en vez de guardar un contador.

   Un programa borrado deja de aparecer aquí (ya no está en `programs`), pero
   el `income` que lo referenciaba no se toca — mismo criterio que un plan MSI
   borrado: "borrar el plan no borra sus pagos" (save-plan.ts). */

import type { BenefitProgram, Transaction } from '../../../shared/domain/types';
import { getBreakdown } from '../../transactions/domain/breakdown';

export function computeBenefitTotals(
  transactions: Transaction[],
  programs: BenefitProgram[],
  sinceIso?: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of programs) totals[p.id] = 0;
  for (const t of transactions) {
    if (sinceIso && t.date < sinceIso) continue;
    if (t.type === 'income') {
      if (!t.benefitProgramId || !(t.benefitProgramId in totals)) continue;
      totals[t.benefitProgramId] = (totals[t.benefitProgramId] ?? 0) + t.amount;
      continue;
    }
    // Un descuento del desglose ligado a un programa es ahorro de ese programa,
    // aunque no sea ingreso (no movió ningún saldo).
    for (const d of getBreakdown(t)?.discounts ?? []) {
      if (!d.benefitProgramId || !(d.benefitProgramId in totals)) continue;
      totals[d.benefitProgramId] = (totals[d.benefitProgramId] ?? 0) + (Number(d.amount) || 0);
    }
  }
  return totals;
}
