/* Acciones sobre `installmentPlans`. La colección vive en `data-slice` y
   `msiModalOpen`/`editingPlan` en `ui-slice`.

   Único lugar de la feature que llama `runRIO`. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { InstallmentPlan, NewInstallmentPlan } from '../../../shared/domain/types';
import { createPlan } from '../application/create-plan';
import { deletePlan, savePlan } from '../application/save-plan';
import type { PlanInput } from '../application/save-plan';

export type InstallmentsSlice = {
  /** Alta inline desde el picker del formulario de movimiento. Devuelve el plan
   *  creado porque quien lo pidió necesita vincularle el pago. */
  createPlan: (input: NewInstallmentPlan) => InstallmentPlan;

  /** Alta o edición desde el formulario completo. Cierra el modal. */
  savePlan: (input: PlanInput) => void;
  deletePlan: (id: string) => void;
  /** `null` abre el formulario en blanco. */
  openPlanForm: (plan: InstallmentPlan | null) => void;
  closePlanForm: () => void;
};

const formClosed = { msiModalOpen: false, editingPlan: null } as const;

export const createInstallmentsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], InstallmentsSlice> =>
  (set, get) => ({
    createPlan: (input) => {
      const result = runRIO(createPlan(get().installmentPlans, input), deps);
      set({ installmentPlans: result.installmentPlans, toast: result.toast });
      return result.plan;
    },

    savePlan: (input) => {
      const result = runRIO(savePlan(get().installmentPlans, input), deps);
      set({ installmentPlans: result.installmentPlans, toast: result.toast, ...formClosed });
    },

    deletePlan: (id) => {
      const { installmentPlans, tombstones } = get();
      const result = runRIO(deletePlan({ installmentPlans, tombstones }, id), deps);
      set({
        installmentPlans: result.installmentPlans,
        tombstones: result.tombstones,
        toast: result.toast,
        ...formClosed,
      });
    },

    openPlanForm: (plan) => set({ editingPlan: plan, msiModalOpen: true }),
    closePlanForm: () => set({ ...formClosed }),
  });
