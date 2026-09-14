/* Casos de uso de programas de beneficios. Modelados 1:1 sobre
   `features/installments/application/save-plan.ts`: mismo patrón de
   alta/edición por `id` presente o ausente, y borrado por tombstone. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { BenefitProgram, NewBenefitProgram, Tombstone } from '../../../shared/domain/types';

/** Alta inline desde el picker del formulario de movimiento. Devuelve el
 *  programa creado porque quien lo pidió necesita su id para dejarlo
 *  seleccionado, igual que `createCategory`/`createPlan`. */
export type CreateProgramResult = {
  benefitPrograms: BenefitProgram[];
  program: BenefitProgram;
  toast: string;
};

export const createProgram =
  (programs: BenefitProgram[], input: NewBenefitProgram): ReaderIO<Deps, CreateProgramResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const program: BenefitProgram = { ...input, id: deps.idGenerator('benefit'), createdAt: now, updatedAt: now };
    return {
      benefitPrograms: [...programs, program],
      program,
      toast: 'Programa creado',
    };
  };

/** Lo que emite el formulario del modal de gestión: sin `id` es alta, con `id` es edición. */
export type ProgramInput = NewBenefitProgram & { id?: string };

export type SaveProgramResult = {
  benefitPrograms: BenefitProgram[];
  toast: string;
};

export const saveProgram =
  (programs: BenefitProgram[], input: ProgramInput): ReaderIO<Deps, SaveProgramResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const { id, ...fields } = input;

    if (id) {
      return {
        benefitPrograms: programs.map((p) => (p.id === id ? { ...p, ...fields, id, updatedAt: now } : p)),
        toast: 'Programa actualizado',
      };
    }
    return {
      benefitPrograms: [...programs, { id: deps.idGenerator('benefit'), ...fields, createdAt: now, updatedAt: now }],
      toast: 'Programa creado',
    };
  };

export type DeleteProgramResult = {
  benefitPrograms: BenefitProgram[];
  tombstones: Tombstone[];
  toast: string;
};

/** Borrar el programa NO borra los ingresos que lo referencian: se quedan,
 *  solo dejan de sumar al resumen — mismo criterio que borrar un plan MSI. */
export const deleteProgram =
  (
    state: { benefitPrograms: BenefitProgram[]; tombstones: Tombstone[] },
    id: string,
  ): ReaderIO<Deps, DeleteProgramResult> =>
  (deps) =>
  () => ({
    benefitPrograms: state.benefitPrograms.filter((p) => p.id !== id),
    tombstones: [...state.tombstones, { id, deletedAt: deps.clock() }],
    toast: 'Programa eliminado',
  });
