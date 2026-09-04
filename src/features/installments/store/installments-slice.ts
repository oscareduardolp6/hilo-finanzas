/* Acciones sobre `installmentPlans`. Por ahora solo el alta inline, que es lo
   que el formulario de movimiento necesita (ver `application/create-plan.ts`);
   el paso 5 añade progreso, edición y borrado.

   Como `createCategory`, devuelve el plan creado para que el picker pueda
   dejarlo seleccionado sin generar ids dentro del render. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { InstallmentPlan, NewInstallmentPlan } from '../../../shared/domain/types';
import { createPlan } from '../application/create-plan';

export type InstallmentsSlice = {
  createPlan: (input: NewInstallmentPlan) => InstallmentPlan;
};

export const createInstallmentsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], InstallmentsSlice> =>
  (set, get) => ({
    createPlan: (input) => {
      const result = runRIO(createPlan(get().installmentPlans, input), deps);
      set({ installmentPlans: result.installmentPlans, toast: result.toast });
      return result.plan;
    },
  });
