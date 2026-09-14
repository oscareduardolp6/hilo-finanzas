/* Los casos de uso de programas de beneficios, con reloj e ids fijos. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { BenefitProgram } from '../../../shared/domain/types';
import { createProgram, deleteProgram, saveProgram } from './save-program';

const AHORA = 1_700_000_000_000;
const deps = createDeps({ clock: () => AHORA, idGenerator: () => 'benefit_fijo' });

const amex: BenefitProgram = {
  id: 'benefit_1', name: 'Starbucks x Amex', icon: 'Gift', color: '#000', accountId: 'acc_amex',
  createdAt: 1, updatedAt: 1,
};

const input = { name: 'Cupón HEB', icon: 'Ticket', color: '#111', accountId: null };

describe('saveProgram', () => {
  it('sin id crea el programa al final, con marcas de tiempo', () => {
    const { benefitPrograms, toast } = runRIO(saveProgram([amex], input), deps);

    expect(toast).toBe('Programa creado');
    expect(benefitPrograms).toEqual([
      amex,
      { id: 'benefit_fijo', ...input, createdAt: AHORA, updatedAt: AHORA },
    ]);
  });

  it('con id edita ese programa y conserva su createdAt', () => {
    const { benefitPrograms, toast } = runRIO(
      saveProgram([amex], { ...input, id: 'benefit_1', name: 'Amex renovado' }),
      deps,
    );

    expect(toast).toBe('Programa actualizado');
    expect(benefitPrograms).toHaveLength(1);
    expect(benefitPrograms[0]).toMatchObject({ id: 'benefit_1', name: 'Amex renovado', createdAt: 1, updatedAt: AHORA });
  });
});

describe('createProgram (alta inline desde el picker)', () => {
  it('devuelve el programa creado, que es lo que el picker necesita', () => {
    const { program } = runRIO(createProgram([], input), deps);
    expect(program).toEqual({ id: 'benefit_fijo', ...input, createdAt: AHORA, updatedAt: AHORA });
  });
});

describe('deleteProgram', () => {
  it('quita el programa y deja lápida', () => {
    const { benefitPrograms, tombstones, toast } = runRIO(
      deleteProgram({ benefitPrograms: [amex], tombstones: [] }, 'benefit_1'),
      deps,
    );

    expect(toast).toBe('Programa eliminado');
    expect(benefitPrograms).toEqual([]);
    expect(tombstones).toEqual([{ id: 'benefit_1', deletedAt: AHORA }]);
  });
});
