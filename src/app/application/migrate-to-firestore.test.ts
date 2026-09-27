import { describe, it, expect } from 'vitest';
import { createDeps } from '../dependencies';
import { runRT } from '../run';
import { inMemoryStateRepository } from '../../shared/infrastructure/in-memory';
import type { DataState } from '../../shared/domain/types';
import { migrateToFirestore } from './migrate-to-firestore';

const stateWith = (overrides: Partial<DataState> = {}): DataState => ({
  accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [], benefitPrograms: [],
  ...overrides,
});

const cuenta = { id: 'a1', name: 'Efectivo', type: 'efectivo' as const, color: '#000', initialBalance: 0 };

describe('migrateToFirestore', () => {
  it('remoto vacío + local con datos -> sube el local a Firestore', async () => {
    const stateRepository = inMemoryStateRepository({ initial: null });
    const legacyLocalStateRepository = inMemoryStateRepository({ initial: stateWith({ accounts: [cuenta] }) });
    const deps = createDeps({ stateRepository, legacyLocalStateRepository });

    await runRT(migrateToFirestore, deps);

    expect(stateRepository.peek()).toEqual(stateWith({ accounts: [cuenta] }));
  });

  it('remoto con datos -> no se toca, aunque el local sea distinto', async () => {
    const remoto = stateWith({ accounts: [{ ...cuenta, id: 'remoto' }] });
    const stateRepository = inMemoryStateRepository({ initial: remoto });
    const legacyLocalStateRepository = inMemoryStateRepository({ initial: stateWith({ accounts: [cuenta] }) });
    const deps = createDeps({ stateRepository, legacyLocalStateRepository });

    await runRT(migrateToFirestore, deps);

    expect(stateRepository.peek()).toEqual(remoto);
  });

  it('remoto vacío + local vacío -> no hace nada', async () => {
    const stateRepository = inMemoryStateRepository({ initial: null });
    const legacyLocalStateRepository = inMemoryStateRepository({ initial: null });
    const deps = createDeps({ stateRepository, legacyLocalStateRepository });

    await runRT(migrateToFirestore, deps);

    expect(stateRepository.peek()).toBeNull();
  });
});
