/* Aplicar el plan: agregar lo nuevo a las cuatro colecciones, sellado con la
   hora de ahora.

   Es un `ReaderIO` y no un `Reader` por el reloj — `updatedAt` es lo único no
   determinista que hay aquí. Los ids ya venían puestos desde
   `buildMonefyImportPlan`, que es quien resolvió la identidad de cada nombre. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { Account, Category, DataState, Stamped } from '../../../shared/domain/types';
import { buildMonefyImportPlan } from '../domain/plan';
import type { AccountDecisions, MonefyImportPlan } from '../domain/plan';
import type { MonefyPreview } from '../domain/preview';

export type PlanImportInput = {
  preview: MonefyPreview;
  accountDecisions: AccountDecisions;
  useOscarConvention: boolean;
  existingAccounts: Account[];
  existingCategories: Category[];
};

/* Decidir qué se va a crear. `ReaderIO` porque genera ids y fecha los
   registros; el resto es una función pura del dominio. Devolver el plan sin
   aplicarlo es lo que deja a la hoja enseñar el resumen antes de tocar nada. */
export const planMonefyImport =
  ({ preview, accountDecisions, useOscarConvention, existingAccounts, existingCategories }: PlanImportInput): ReaderIO<Deps, MonefyImportPlan> =>
  (deps) =>
  () =>
    buildMonefyImportPlan(preview.skeleton, preview.initialBalances, {
      accountDecisions,
      existingAccounts,
      existingCategories,
      useOscarConvention,
      now: deps.clock(),
      newId: deps.idGenerator,
    });

export type ImportMonefyResult = Pick<
  DataState, 'accounts' | 'categories' | 'transactions' | 'installmentPlans'
> & {
  toast: string;
};

export const importMonefy =
  (current: DataState, plan: MonefyImportPlan): ReaderIO<Deps, ImportMonefyResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    /* Solo `updatedAt`, no `createdAt`: el plan ya trae el suyo correlativo, y
       las cuentas y categorías nunca lo llevaron. Es asimétrico, pero es lo que
       hay guardado en los perfiles que ya importaron. */
    const stamp = <T extends Stamped>(r: T): T => ({ ...r, updatedAt: now });
    return {
      accounts: plan.accountsToAdd.length
        ? [...current.accounts, ...plan.accountsToAdd.map(stamp)]
        : current.accounts,
      categories: plan.categoriesToAdd.length
        ? [...current.categories, ...plan.categoriesToAdd.map(stamp)]
        : current.categories,
      installmentPlans: plan.installmentPlansToAdd.length
        ? [...current.installmentPlans, ...plan.installmentPlansToAdd.map(stamp)]
        : current.installmentPlans,
      transactions: [...current.transactions, ...plan.transactions.map(stamp)],
      toast: `Se importaron ${plan.transactions.length} movimientos de Monefy`,
    };
  };
