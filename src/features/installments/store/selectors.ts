/* Selectores de la feature. Otras features pueden importarlos (Inicio pinta el
   avance de los planes activos); su `ui/` no.

   `selectPlanProgress` devuelve un objeto nuevo, así que NO se pasa a
   `useHiloStore` — va dentro de un `useMemo` sobre las colecciones. */

import type { HiloStore } from '../../../app/store';
import type { InstallmentPlan, PlanProgress, Transaction } from '../../../shared/domain/types';
import { computePlanProgress } from '../domain/progress';

export const selectPlans = (s: HiloStore): InstallmentPlan[] => s.installmentPlans;
export const selectPlanModalOpen = (s: HiloStore): boolean => s.msiModalOpen;
export const selectEditingPlan = (s: HiloStore): InstallmentPlan | null => s.editingPlan;

/** Envuélvelo en `useMemo`: devuelve un objeto nuevo. */
export const selectPlanProgress = (s: {
  installmentPlans: InstallmentPlan[];
  transactions: Transaction[];
}): Record<string, PlanProgress> => computePlanProgress(s.installmentPlans, s.transactions);
