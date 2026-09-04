/* Caso de uso: crear un plan MSI desde el alta inline del picker.

   Adelanto del paso 5: el formulario de movimiento necesita crear planes, y la
   alternativa era que `transactions` importara el `ui/` de `installments`, que
   la arquitectura prohíbe. El resto de la feature (progreso, edición, borrado,
   MsiView) llega en su paso. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { InstallmentPlan, NewInstallmentPlan } from '../../../shared/domain/types';

export type CreatePlanResult = {
  installmentPlans: InstallmentPlan[];
  /** El creado: quien lo pidió lo necesita para vincularle el pago. */
  plan: InstallmentPlan;
  toast: string;
};

export const createPlan =
  (plans: InstallmentPlan[], input: NewInstallmentPlan): ReaderIO<Deps, CreatePlanResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const plan: InstallmentPlan = {
      ...input,
      id: deps.idGenerator('msi'),
      createdAt: now,
      updatedAt: now,
    };
    return {
      installmentPlans: [...plans, plan],
      plan,
      toast: 'Plan de MSI creado',
    };
  };
