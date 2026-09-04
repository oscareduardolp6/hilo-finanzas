/* Los casos de uso, corridos con `Deps` inyectadas: sin React, sin IndexedDB,
   sin mocks de módulo. El reloj y el generador de ids son fijos, así que el
   resultado es comparable con `toEqual` — que es justo lo que el refactor vino
   a comprar: antes `Date.now()` y `uid()` se llamaban dentro del handler. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { Account } from '../../../shared/domain/types';
import { deleteAccount } from './delete-account';
import { saveAccount } from './save-account';

const AHORA = 1_700_000_000_000;

const deps = createDeps({ clock: () => AHORA, idGenerator: () => 'acc_fijo' });

const nu: Account = {
  id: 'acc_1',
  name: 'NU',
  type: 'credito',
  color: '#C9A24B',
  initialBalance: 100,
  createdAt: 1,
  updatedAt: 1,
};

describe('saveAccount', () => {
  it('sin id crea la cuenta al final, con id y marcas de tiempo', () => {
    const { accounts, toast } = runRIO(
      saveAccount([nu], { name: 'Ahorros', type: 'ahorro', color: '#3F9C8B', initialBalance: 2500 }),
      deps,
    );

    expect(toast).toBe('Cuenta creada');
    expect(accounts).toEqual([
      nu,
      {
        id: 'acc_fijo',
        name: 'Ahorros',
        type: 'ahorro',
        color: '#3F9C8B',
        initialBalance: 2500,
        createdAt: AHORA,
        updatedAt: AHORA,
      },
    ]);
  });

  it('con id edita esa cuenta y solo mueve `updatedAt`', () => {
    const { accounts, toast } = runRIO(
      saveAccount([nu], { id: 'acc_1', name: 'NU', type: 'credito', color: '#C9A24B', initialBalance: 1500 }),
      deps,
    );

    expect(toast).toBe('Cuenta actualizada');
    expect(accounts).toEqual([{ ...nu, initialBalance: 1500, updatedAt: AHORA }]);
    // `createdAt` se conserva: es el desempate del merge de sync junto a
    // `updatedAt`, y pisarlo rompería el orden de una fusión posterior.
    expect(accounts[0]?.createdAt).toBe(1);
  });

  it('no muta la colección que recibe', () => {
    const original = [nu];
    runRIO(saveAccount(original, { name: 'Otra', type: 'otro', color: '#000', initialBalance: 0 }), deps);
    expect(original).toEqual([nu]);
  });

  it('construirlo no ejecuta nada: el efecto ocurre al correrlo', () => {
    let llamadasAlReloj = 0;
    const espia = createDeps({ clock: () => { llamadasAlReloj += 1; return AHORA; }, idGenerator: () => 'x' });

    const useCase = saveAccount([], { name: 'A', type: 'otro', color: '#000', initialBalance: 0 });
    expect(llamadasAlReloj).toBe(0);

    runRIO(useCase, espia);
    expect(llamadasAlReloj).toBe(1);
  });
});

describe('deleteAccount', () => {
  it('quita la cuenta y deja una lápida con la hora del borrado', () => {
    const { accounts, tombstones, toast } = runRIO(
      deleteAccount({ accounts: [nu], tombstones: [] }, 'acc_1'),
      deps,
    );

    expect(toast).toBe('Cuenta eliminada');
    expect(accounts).toEqual([]);
    // Sin lápida, el siguiente merge vería la cuenta "ausente" y no "borrada",
    // y el otro dispositivo se la devolvería.
    expect(tombstones).toEqual([{ id: 'acc_1', deletedAt: AHORA }]);
  });

  it('conserva las lápidas que ya había', () => {
    const previa = { id: 'viejo', deletedAt: 1 };
    const { tombstones } = runRIO(
      deleteAccount({ accounts: [nu], tombstones: [previa] }, 'acc_1'),
      deps,
    );
    expect(tombstones).toEqual([previa, { id: 'acc_1', deletedAt: AHORA }]);
  });
});
