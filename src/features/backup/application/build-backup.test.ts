/* Los dos casos de uso de armar un respaldo, con reloj fijo. Sin React ni
   IndexedDB: es lo que compran el Reader y el reloj inyectado. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runR, runRT } from '../../../app/run';
import type { Account, DataState, Transaction } from '../../../shared/domain/types';
import { base64ToBytes, gunzipBytes } from '../../../shared/infrastructure/compression';
import { EXPORT_TEXT_PREFIX } from '../../sync/domain/payload';
import { backupText, buildBackup } from './build-backup';

// 2026-09-05T00:00:00 local; el nombre del archivo usa el reloj LOCAL a
// propósito (lo lee una persona buscando "el de ayer").
const AHORA = new Date(2026, 8, 5, 12, 0, 0).getTime();
const deps = createDeps({ clock: () => AHORA });

const cuenta: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 100 };
const viejo: Transaction = {
  id: 't1', type: 'expense', date: '2020-01-01', amount: 50, description: 'De hace años',
  accountId: 'a1', categoryId: 'comida', createdAt: 1, updatedAt: 1,
} as Transaction;

const estado: DataState = {
  accounts: [cuenta], categories: [], transactions: [viejo], installmentPlans: [], tombstones: [],
};

describe('buildBackup', () => {
  it('es siempre la foto completa: nunca parcial y sin device', () => {
    const { payload } = runR(buildBackup(estado), deps);

    expect(payload.partial).toBe(false);
    expect(payload.since).toBeNull();
    expect(payload.device).toBeNull();
    // Un respaldo no filtra por antigüedad, a diferencia de un delta de sync.
    expect(payload.data.transactions).toEqual([viejo]);
    expect(payload.data.accounts).toEqual([cuenta]);
  });

  it('fecha el archivo con el reloj inyectado', () => {
    expect(runR(buildBackup(estado), deps).fileName).toBe('hilo-respaldo-2026-09-05.json');
  });
});

describe('backupText', () => {
  it('devuelve el JSON comprimido, y descomprimirlo da el mismo payload', async () => {
    const text = await runRT(backupText(estado), deps);

    expect(text).not.toBeNull();
    expect(text!.startsWith(EXPORT_TEXT_PREFIX)).toBe(true);

    const json = await gunzipBytes(base64ToBytes(text!.slice(EXPORT_TEXT_PREFIX.length)));
    expect(JSON.parse(json)).toEqual(runR(buildBackup(estado), deps).payload);
  });
});
