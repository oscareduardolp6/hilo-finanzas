/* Casos de uso del formulario completo de plan MSI (`MsiPlanModal`).

   Ojo con los toasts: este alta dice 'Plan creado' y la de `create-plan.ts`
   (el alta inline desde el picker, dentro del formulario de movimiento) dice
   'Plan de MSI creado'. Son dos textos distintos en el producto desde antes del
   refactor; unificarlos sería un cambio de comportamiento, no un refactor. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { InstallmentPlan, NewInstallmentPlan, Tombstone } from '../../../shared/domain/types';

/** Lo que emite el formulario: sin `id` es alta, con `id` es edición. */
export type PlanInput = NewInstallmentPlan & { id?: string };

export type SavePlanResult = {
  installmentPlans: InstallmentPlan[];
  toast: string;
};

export const savePlan =
  (plans: InstallmentPlan[], input: PlanInput): ReaderIO<Deps, SavePlanResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const { id, ...fields } = input;

    if (id) {
      return {
        installmentPlans: plans.map((p) => (p.id === id ? { ...p, ...fields, id, updatedAt: now } : p)),
        toast: 'Plan actualizado',
      };
    }
    return {
      installmentPlans: [...plans, { id: deps.idGenerator('msi'), ...fields, createdAt: now, updatedAt: now }],
      toast: 'Plan creado',
    };
  };

export type DeletePlanResult = {
  installmentPlans: InstallmentPlan[];
  tombstones: Tombstone[];
  toast: string;
};

/** Borrar el plan NO borra sus pagos: los movimientos se quedan, solo dejan de
 *  agruparse como MSI. Es lo que avisa el modal antes de confirmar. */
export const deletePlan =
  (
    state: { installmentPlans: InstallmentPlan[]; tombstones: Tombstone[] },
    id: string,
  ): ReaderIO<Deps, DeletePlanResult> =>
  (deps) =>
  () => ({
    installmentPlans: state.installmentPlans.filter((p) => p.id !== id),
    tombstones: [...state.tombstones, { id, deletedAt: deps.clock() }],
    toast: 'Plan eliminado',
  });
