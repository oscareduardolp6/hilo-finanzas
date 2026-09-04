/* El avance de un plan MSI NO se guarda: se deriva sumando sus abonos.

   Por eso admite pagos parciales y desiguales — el progreso es por monto, no por
   número de pagos. Se migra ya (y no en el paso 5) porque el formulario de
   movimiento necesita pintar el avance al elegir plan, y una feature puede
   importar el `domain/` de otra pero no su `ui/`. */

import type { InstallmentPlan, Transaction } from '../../../shared/domain/types';

export type PlanProgress = {
  paid: number;
  /** Cuánto toca por pago completo. */
  per: number;
  /** Pagado / `per`: puede ser fraccionario (2.5 de 6). */
  installmentsPaid: number;
  remaining: number;
  /** 0–1, ya acotado. */
  pct: number;
  isPaidOff: boolean;
};

export function computePlanProgress(
  installmentPlans: InstallmentPlan[],
  transactions: Transaction[],
): Record<string, PlanProgress> {
  const map: Record<string, PlanProgress> = {};
  for (const p of installmentPlans) {
    // Un gasto simple también abona, no solo una transferencia: no todo pago de
    // MSI pasa por una segunda cuenta de "tarjeta".
    const paid = transactions
      .filter(t => (t.type === 'transfer' || t.type === 'expense') && t.installmentPlanId === p.id)
      .reduce((s, t) => s + t.amount, 0);
    const per = p.installmentsCount > 0 ? p.totalAmount / p.installmentsCount : 0;
    const installmentsPaid = per > 0 ? paid / per : 0;
    const remaining = Math.max(p.totalAmount - paid, 0);
    const pct = p.totalAmount > 0 ? Math.min(paid / p.totalAmount, 1) : 0;
    // Margen de medio centavo: sumar pagos en punto flotante no da exacto.
    const isPaidOff = p.totalAmount > 0 && paid >= p.totalAmount - 0.005;
    map[p.id] = { paid, per, installmentsPaid, remaining, pct, isPaidOff };
  }
  return map;
}
