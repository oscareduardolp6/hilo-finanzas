/* Acciones sobre `benefitPrograms`. La colección vive en `data-slice` y
   `benefitsModalOpen`/`editingBenefitProgram` en `ui-slice`.

   Único lugar de la feature que llama `runRIO`. Modelado sobre
   `features/installments/store/installments-slice.ts`. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { BenefitProgram, NewBenefitProgram } from '../../../shared/domain/types';
import { createProgram, deleteProgram, saveProgram } from '../application/save-program';
import type { ProgramInput } from '../application/save-program';

export type BenefitsSlice = {
  /** Alta inline desde el picker del formulario de movimiento. Devuelve el
   *  programa creado porque quien lo pidió necesita vincularlo al ingreso. */
  createProgram: (input: NewBenefitProgram) => BenefitProgram;

  /** Alta o edición desde el modal de gestión. */
  saveProgram: (input: ProgramInput) => void;
  deleteProgram: (id: string) => void;
};

export const createBenefitsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], BenefitsSlice> =>
  (set, get) => ({
    createProgram: (input) => {
      const result = runRIO(createProgram(get().benefitPrograms, input), deps);
      set({ benefitPrograms: result.benefitPrograms, toast: result.toast });
      return result.program;
    },

    saveProgram: (input) => {
      const result = runRIO(saveProgram(get().benefitPrograms, input), deps);
      set({ benefitPrograms: result.benefitPrograms, toast: result.toast, editingBenefitProgram: null });
    },

    deleteProgram: (id) => {
      const { benefitPrograms, tombstones } = get();
      const result = runRIO(deleteProgram({ benefitPrograms, tombstones }, id), deps);
      set({
        benefitPrograms: result.benefitPrograms,
        tombstones: result.tombstones,
        toast: result.toast,
        editingBenefitProgram: null,
      });
    },
  });
