/* El caso de uso de recibir, con reloj fijo. Sin React y sin IndexedDB: es
   exactamente lo que el patrón repository y el Reader compran. */

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import { createDeps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import type { DataState, SyncState, Transaction } from '../../../shared/domain/types';
import { buildExportPayload } from '../domain/payload';
import { receiveSync } from './receive-sync';

const AHORA = 1_700_000_000_000;
const deps = createDeps({ clock: () => AHORA });

const txn = (id: string, updatedAt: number): Transaction => ({
  id, type: 'expense', date: '2026-01-05', amount: 100, description: id,
  accountId: 'a1', categoryId: 'comida', createdAt: updatedAt, updatedAt,
} as Transaction);

const vacio = (): DataState => ({
  accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [], benefitPrograms: [],
});

const syncState: SyncState = { deviceId: 'yo', deviceName: 'Laptop', peers: {} };

const comoTexto = (state: DataState, device?: { id: string; name: string }) =>
  ({ kind: 'text' as const, text: JSON.stringify(buildExportPayload(state, device ? { device } : {})) });

describe('receiveSync', () => {
  it('funde lo entrante y resume lo que pasó', async () => {
    const mio = { ...vacio(), transactions: [txn('t1', 10)] };
    const suyo = { ...vacio(), transactions: [txn('t2', 20)] };

    const result = await runRTE(receiveSync(mio, syncState, comoTexto(suyo)), deps);

    expect(E.isRight(result)).toBe(true);
    if (E.isLeft(result)) return;
    expect(result.right.data.transactions.map(t => t.id).sort()).toEqual(['t1', 't2']);
    expect(result.right.toast).toBe('Sincronizado: 1 nuevos, 0 actualizados, 0 borrados');
  });

  it('anota el punto del emisor cuando el payload lo identifica', async () => {
    const fuente = comoTexto(vacio(), { id: 'tel', name: 'Teléfono' });

    const result = await runRTE(receiveSync(vacio(), syncState, fuente), deps);

    if (E.isLeft(result)) throw new Error('debería haber ido bien');
    expect(result.right.syncState!.peers['tel']).toMatchObject({ name: 'Teléfono' });
    expect(result.right.toast).toContain('con Teléfono');
  });

  it('sin device no hay peer que anotar', async () => {
    const result = await runRTE(receiveSync(vacio(), syncState, comoTexto(vacio())), deps);

    if (E.isLeft(result)) throw new Error('debería haber ido bien');
    expect(result.right.syncState).toBeNull();
  });

  it('un texto que no es de Hilo sale por el canal de error, no como excepción', async () => {
    const result = await runRTE(receiveSync(vacio(), syncState, { kind: 'text', text: 'hola' }), deps);

    expect(result).toEqual(E.left({ _tag: 'InvalidPayload', message: 'Esto no parece un export de Hilo.' }));
  });

  it('unos bytes que no son un QR de Hilo también', async () => {
    const source = { kind: 'bytes' as const, bytes: new Uint8Array([1, 2, 3]) };

    const result = await runRTE(receiveSync(vacio(), syncState, source), deps);

    expect(result).toEqual(E.left({ _tag: 'InvalidPayload', message: 'El QR no contiene datos de Hilo legibles.' }));
  });

  it('un delta no borra lo que no lleva', async () => {
    // Es la regla que hace posible el sync incremental: la ausencia de un
    // registro nunca es un borrado.
    const mio = { ...vacio(), transactions: [txn('viejo', 10), txn('t1', 10)] };
    const delta = { kind: 'text' as const, text: JSON.stringify({
      app: 'hilo-finanzas', schema: 1, exportedAt: new Date(AHORA).toISOString(),
      device: null, partial: true, since: 15,
      data: { accounts: [], categories: [], transactions: [txn('t1', 99)], installmentPlans: [], tombstones: [] },
    }) };

    const result = await runRTE(receiveSync(mio, syncState, delta), deps);

    if (E.isLeft(result)) throw new Error('debería haber ido bien');
    expect(result.right.data.transactions.map(t => t.id).sort()).toEqual(['t1', 'viejo']);
    expect(result.right.toast).toContain('(parcial)');
  });
});
