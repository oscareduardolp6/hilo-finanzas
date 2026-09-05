/* Acciones del import de Monefy: leer el CSV, planear y aplicar.

   Único punto de la feature que corre una mónada y hace `match` del `Either`.
   El fallo de leer NO sale como toast —va bajo el selector de archivo, hablando
   del archivo que el usuario acaba de elegir—; el éxito de aplicar sí, porque
   para entonces la hoja ya se cerró. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO, runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { selectDataState } from '../../../app/store/data-slice';
import { messageFor } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { importMonefy, planMonefyImport } from '../application/import-monefy';
import type { PlanImportInput } from '../application/import-monefy';
import { readMonefyFile } from '../application/read-monefy-file';
import type { MonefyImportPlan } from '../domain/plan';
import type { MonefyPreview } from '../domain/preview';

export type ReadMonefyOutcome =
  | { readonly ok: true; readonly preview: MonefyPreview }
  | { readonly ok: false; readonly message: string };

/** Lo que la hoja necesita decidir; las cuentas existentes las pone el slice,
 *  que es quien tiene el store. */
export type PlanRequest = Pick<PlanImportInput, 'preview' | 'accountDecisions' | 'useOscarConvention'>;

export type MonefySlice = {
  /** Lee el CSV y devuelve la revisión, sin aplicar nada. */
  readMonefyFile: (file: File) => Promise<ReadMonefyOutcome>;
  /** Decide qué se crearía. Tampoco aplica: devuelve el plan. */
  planMonefyImport: (request: PlanRequest) => MonefyImportPlan;
  /** Aplica el plan a las cuatro colecciones. */
  importMonefy: (plan: MonefyImportPlan) => void;
};

export const createMonefySlice =
  (deps: Deps): StateCreator<HiloStore, [], [], MonefySlice> =>
  (set, get) => ({
    readMonefyFile: async (file) => {
      const result = await runRTE(readMonefyFile(file), deps);
      return pipe(
        result,
        E.match(
          (error: HiloError): ReadMonefyOutcome => ({ ok: false, message: messageFor(error) }),
          (preview): ReadMonefyOutcome => ({ ok: true, preview }),
        ),
      );
    },

    planMonefyImport: (request) => {
      const { accounts, categories } = get();
      return runRIO(
        planMonefyImport({ ...request, existingAccounts: accounts, existingCategories: categories }),
        deps,
      );
    },

    importMonefy: (plan) => {
      set(runRIO(importMonefy(selectDataState(get()), plan), deps));
    },
  });
