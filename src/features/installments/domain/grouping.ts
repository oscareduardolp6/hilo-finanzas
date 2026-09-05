/* Cómo se ordenan y agrupan los planes en la pantalla de MSI.

   Estaba duplicado literal entre `MsiView` y `MsiViewDesktop`; al migrarlas se
   extrajo aquí, que además lo vuelve testeable sin montar nada. */

import type { InstallmentPlan, PlanProgress, Transaction } from '../../../shared/domain/types';

export type GroupedPlans = {
  /** Los que aún deben algo, del más reciente al más viejo. */
  active: InstallmentPlan[];
  completed: InstallmentPlan[];
};

/** Un plan sin entrada en `progress` cuenta como activo: es lo que hacía el
 *  original (`!(progress[id] && progress[id].isPaidOff)`), y es lo correcto —
 *  sin datos de avance no se puede afirmar que esté pagado. */
export function isPlanPaidOff(planId: string, progress: Record<string, PlanProgress>): boolean {
  return !!(progress[planId] && progress[planId]!.isPaidOff);
}

/** Los planes que aún deben algo, **en el orden en que vienen**. Lo usa Inicio,
 *  que muestra solo los primeros y no reordena; la pantalla de MSI usa
 *  `groupPlansByStatus`, que además ordena. */
export function activePlans(
  plans: InstallmentPlan[],
  progress: Record<string, PlanProgress>,
): InstallmentPlan[] {
  return plans.filter(p => !isPlanPaidOff(p.id, progress));
}

export function groupPlansByStatus(
  plans: InstallmentPlan[],
  progress: Record<string, PlanProgress>,
): GroupedPlans {
  const byNewest = (a: InstallmentPlan, b: InstallmentPlan) => (b.createdAt ?? 0) - (a.createdAt ?? 0);
  return {
    active: activePlans(plans, progress).sort(byNewest),
    completed: plans.filter(p => isPlanPaidOff(p.id, progress)).sort(byNewest),
  };
}

/** Los abonos a un plan, del más reciente al más viejo. Es lo que lista el
 *  modal bajo "Pagos registrados". */
export function planPayments(planId: string, transactions: Transaction[]): Transaction[] {
  return transactions
    .filter(t => 'installmentPlanId' in t && t.installmentPlanId === planId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
