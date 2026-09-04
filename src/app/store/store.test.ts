/* Tests del store y del guardado automático, sin React.

   Cubren los tres detalles del `useEffect` original que es fácil perder al
   moverlo a una suscripción, y que la suite de integración solo comprueba de
   forma indirecta a través del DOM. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../dependencies';
import { subscribePersistence } from '../persistence';
import {
  brokenPersistence,
  inMemoryOcrSettingsRepository,
  inMemoryStateRepository,
  inMemorySyncStateRepository,
} from '../../shared/infrastructure/in-memory';
import type { DataState } from '../../shared/domain/types';
import { createHiloStore } from './index';

const stateWith = (overrides: Partial<DataState> = {}): DataState => ({
  accounts: [],
  categories: [],
  transactions: [],
  installmentPlans: [],
  tombstones: [],
  ...overrides,
});

const cuenta = { id: 'acc_1', name: 'NU', type: 'debito' as const, color: '#000', initialBalance: 10 };

/** Deja correr las promesas pendientes de la suscripción. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(options: { stored?: DataState | null; failSave?: boolean } = {}) {
  const stateRepository = inMemoryStateRepository(
    options.failSave ? { failWith: brokenPersistence() } : { initial: options.stored ?? null },
  );
  const syncStateRepository = inMemorySyncStateRepository();
  const deps = createDeps({
    stateRepository,
    syncStateRepository,
    ocrSettingsRepository: inMemoryOcrSettingsRepository(),
    idGenerator: () => 'dev_fijo',
    clock: () => 1_700_000_000_000,
  });
  const store = createHiloStore(deps);
  const unsubscribe = subscribePersistence(store, deps);
  return { store, deps, stateRepository, syncStateRepository, unsubscribe };
}

describe('hidratación', () => {
  it('sin datos guardados conserva la semilla de demo y marca loaded', async () => {
    const { store } = setup();

    await store.getState().hydrateFromRepositories();

    expect(store.getState().loaded).toBe(true);
    expect(store.getState().accounts).toHaveLength(3);
    expect(store.getState().transactions.length).toBeGreaterThan(0);
  });

  it('con datos guardados los adopta', async () => {
    const { store } = setup({ stored: stateWith({ accounts: [cuenta] }) });

    await store.getState().hydrateFromRepositories();

    expect(store.getState().accounts).toEqual([cuenta]);
  });

  it('un blob viejo sin tombstones no rompe: la colección queda en su valor inicial', async () => {
    // El doble cast es el punto del test: simula un blob escrito por una versión
    // anterior a los tombstones, que por tipos no debería existir pero sí existe
    // en el IndexedDB de usuarios reales.
    const legacyBlob = { accounts: [cuenta], categories: [], transactions: [], installmentPlans: [] };
    const { store } = setup({ stored: legacyBlob as unknown as DataState });

    await store.getState().hydrateFromRepositories();

    expect(store.getState().tombstones).toEqual([]);
    expect(store.getState().accounts).toEqual([cuenta]);
  });

  it('bautiza un dispositivo si no había sync state', async () => {
    const { store } = setup();

    await store.getState().hydrateFromRepositories();

    expect(store.getState().syncState).toEqual({
      deviceId: 'dev_fijo',
      deviceName: 'Equipo-fijo',
      peers: {},
    });
  });
});

describe('guardado automático', () => {
  it('no guarda nada antes de hidratar', async () => {
    const { store, stateRepository } = setup();

    store.getState().setAccounts([cuenta]);
    await flush();

    // Es el punto del guard `if (!loaded) return`: sin él, la semilla de demo
    // pisaría los datos del usuario antes de haberlos leído.
    expect(stateRepository.peek()).toBeNull();
  });

  it('guarda en cuanto termina la hidratación, aunque no haya cambiado nada', async () => {
    const { store, stateRepository } = setup();

    await store.getState().hydrateFromRepositories();
    await flush();

    // El efecto original tenía `loaded` en sus dependencias, así que persistía
    // la semilla de demo en un perfil nuevo. Ese disparo se conserva.
    expect(stateRepository.peek()).not.toBeNull();
    expect(stateRepository.peek()?.accounts).toHaveLength(3);
  });

  it('guarda cada cambio posterior', async () => {
    const { store, stateRepository } = setup();
    await store.getState().hydrateFromRepositories();
    await flush();

    store.getState().setAccounts([cuenta]);
    await flush();

    expect(stateRepository.peek()?.accounts).toEqual([cuenta]);
  });

  it('un fallo de guardado se convierte en toast', async () => {
    const { store } = setup({ failSave: true });

    await store.getState().hydrateFromRepositories();
    await flush();

    expect(store.getState().toast).toBe('No se pudo guardar el cambio localmente');
  });

  it('el sync state se guarda bajo su propia clave, no dentro del blob', async () => {
    const { store, stateRepository, syncStateRepository } = setup();

    await store.getState().hydrateFromRepositories();
    await flush();

    expect(syncStateRepository.peek()?.deviceId).toBe('dev_fijo');
    expect(Object.keys(stateRepository.peek() ?? {})).toEqual([
      'accounts',
      'categories',
      'transactions',
      'installmentPlans',
      'tombstones',
    ]);
  });

  it('al cortar la suscripción deja de guardar', async () => {
    const { store, stateRepository, unsubscribe } = setup();
    await store.getState().hydrateFromRepositories();
    await flush();
    const antes = stateRepository.peek();

    unsubscribe();
    store.getState().setAccounts([cuenta]);
    await flush();

    expect(stateRepository.peek()).toBe(antes);
  });
});

describe('setters estilo useState', () => {
  it('aceptan un valor', () => {
    const { store } = setup();
    store.getState().setFilterType('income');
    expect(store.getState().filterType).toBe('income');
  });

  it('aceptan una función actualizadora, que es como los llaman los handlers', () => {
    const { store } = setup();
    store.getState().setTombstones([{ id: 'a', deletedAt: 1 }]);

    store.getState().setTombstones((prev) => [...prev, { id: 'b', deletedAt: 2 }]);

    expect(store.getState().tombstones).toEqual([
      { id: 'a', deletedAt: 1 },
      { id: 'b', deletedAt: 2 },
    ]);
  });
});
