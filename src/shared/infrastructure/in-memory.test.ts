/* Prueba los cimientos del refactor: que un caso de uso se puede correr con
   dependencias en memoria, sin IndexedDB, sin mocks de módulo y sin React, y
   que el canal de error tipado llega hasta el `Either`.

   El "caso de uso" de aquí es de mentira a propósito: lo que se verifica es el
   cableado (Reader → Task → Either → repositorio), no una regla de negocio. */

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { pipe } from 'fp-ts/function';

import { createDeps } from '../../app/dependencies';
import type { Deps } from '../../app/dependencies';
import { runRIO, runRTE } from '../../app/run';
import { messageFor } from '../domain/errors';
import type { DataState } from '../domain/types';
import {
  brokenPersistence,
  inMemoryOcrSettingsRepository,
  inMemoryStateRepository,
} from './in-memory';

const emptyState: DataState = {
  accounts: [],
  categories: [],
  transactions: [],
  installmentPlans: [],
  tombstones: [],
};

/** Caso de uso de ejemplo: lee el estado, agrega una cuenta con id y reloj
 *  inyectados, y lo guarda. Devuelve el estado resultante. */
const addAccount = (name: string): RTE.ReaderTaskEither<Deps, import('../domain/errors').HiloError, DataState> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chain((deps) =>
      pipe(
        deps.stateRepository.load,
        RTE.fromTaskEither,
        RTE.map((loaded): DataState => {
          const state = loaded ?? emptyState;
          return {
            ...state,
            accounts: [
              ...state.accounts,
              {
                id: deps.idGenerator('acc'),
                name,
                type: 'efectivo',
                color: '#C9A24B',
                initialBalance: 0,
                createdAt: deps.clock(),
                updatedAt: deps.clock(),
              },
            ],
          };
        }),
        RTE.chainFirst((next) => RTE.fromTaskEither(deps.stateRepository.save(next))),
      ),
    ),
  );

describe('cimientos: dependencias inyectadas', () => {
  it('corre un caso de uso con repositorio en memoria y persiste el resultado', async () => {
    const stateRepository = inMemoryStateRepository({ initial: emptyState });
    const deps = createDeps({
      stateRepository,
      clock: () => 1_700_000_000_000,
      idGenerator: () => 'acc_fijo',
    });

    const result = await runRTE(addAccount('Efectivo'), deps);

    expect(E.isRight(result)).toBe(true);
    // El repositorio recibió exactamente lo que devolvió el caso de uso.
    expect(stateRepository.peek()?.accounts).toEqual([
      {
        id: 'acc_fijo',
        name: 'Efectivo',
        type: 'efectivo',
        color: '#C9A24B',
        initialBalance: 0,
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    ]);
  });

  it('un fallo de persistencia viaja como Left, no como excepción', async () => {
    const deps = createDeps({
      stateRepository: inMemoryStateRepository({ failWith: brokenPersistence() }),
    });

    const result = await runRTE(addAccount('Efectivo'), deps);

    expect(E.isLeft(result)).toBe(true);
    if (E.isLeft(result)) {
      expect(result.left._tag).toBe('PersistenceError');
      // El mismo texto que hoy asserta test/integration/persistence-desktop.test.jsx.
      expect(messageFor(result.left)).toBe('No se pudo guardar el cambio localmente');
    }
  });

  it('el generador de ids y el reloj por defecto son los reales', () => {
    const deps = createDeps();
    expect(deps.idGenerator('txn')).toMatch(/^txn_/);
    expect(deps.clock()).toBeGreaterThan(1_600_000_000_000);
  });

  it('runRIO ejecuta un caso de uso síncrono con dependencias', () => {
    const deps = createDeps({ idGenerator: () => 'id_fijo' });
    const nextId = runRIO((d: Deps) => () => d.idGenerator('acc'), deps);
    expect(nextId).toBe('id_fijo');
  });
});

describe('repositorio de OCR en memoria', () => {
  it('guardar una config vacía borra la entrada, igual que el real', async () => {
    const repo = inMemoryOcrSettingsRepository({ initial: { apiKey: 'sk-vieja', model: '' } });

    await repo.save({ apiKey: '', model: '' })();

    expect(repo.peek()).toBeNull();
  });

  it('guardar una config con api key la conserva', async () => {
    const repo = inMemoryOcrSettingsRepository();

    await repo.save({ apiKey: 'sk-test', model: 'claude-haiku-4-5' })();

    expect(repo.peek()).toEqual({ apiKey: 'sk-test', model: 'claude-haiku-4-5' });
  });
});
