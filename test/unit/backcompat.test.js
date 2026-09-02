import { describe, it, expect } from 'vitest';
import {
  computePlanProgress,
  mergeCollection,
  mergeDataState,
  normalizeExportPayload,
  buildExportPayload,
} from '../../hilo-finanzas.jsx';

/* Datos escritos por builds anteriores siguen viviendo en el IndexedDB del
   usuario tal cual se guardaron. Estos tests fijan que las funciones toleran
   registros/envelopes viejos. Ver "Backward compatibility" en CLAUDE.md. */

describe('registros sin updatedAt (pre device-sync)', () => {
  it('computePlanProgress: los pagos cuentan usando createdAt como stamp implícito', () => {
    // computePlanProgress no mira el stamp, sólo suma; el punto es que no rompe.
    const plan = { id: 'p1', totalAmount: 100, installmentsCount: 2 };
    const legacyTxns = [
      { id: 't1', type: 'expense', installmentPlanId: 'p1', amount: 40, createdAt: 111 }, // sin updatedAt
    ];
    expect(computePlanProgress([plan], legacyTxns).p1.paid).toBe(40);
  });

  it('mergeCollection: recordStamp cae a createdAt para desempatar', () => {
    const current = [{ id: 'a', createdAt: 100, v: 'local' }];      // sin updatedAt
    const incoming = [{ id: 'a', createdAt: 200, v: 'incoming' }];  // sin updatedAt, más nuevo
    const res = mergeCollection(current, incoming, new Map());
    expect(res.list[0].v).toBe('incoming');
    expect(res.updated).toBe(1);
  });
});

describe('blob sin la colección tombstones', () => {
  it('mergeDataState no truena si current.tombstones es undefined', () => {
    const legacyCurrent = {
      accounts: [{ id: 'a', createdAt: 1 }],
      categories: [], transactions: [], installmentPlans: [],
      // tombstones ausente
    };
    const incoming = { accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] };
    const merged = mergeDataState(legacyCurrent, incoming);
    expect(merged.tombstones).toEqual([]);
    expect(merged.accounts).toHaveLength(1);
  });
});

describe('export pre-delta (sin device / partial / since)', () => {
  const legacyPayload = {
    app: 'hilo-finanzas',
    schema: 1,
    exportedAt: '2025-06-01T00:00:00.000Z',
    data: {
      accounts: [{ id: 'acc1', createdAt: 10 }],
      categories: [],
      transactions: [{ id: 'txn1', createdAt: 10 }],
      installmentPlans: [],
      // sin tombstones tampoco
    },
  };

  it('normalizeExportPayload -> device:null, partial:false, since:null, tombstones:[]', () => {
    const norm = normalizeExportPayload(legacyPayload);
    expect(norm).toMatchObject({ device: null, partial: false, since: null });
    expect(norm.tombstones).toEqual([]);
  });

  it('el merge de un payload viejo da el mismo resultado que uno con envelope nuevo', () => {
    const current = { accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] };

    const fromLegacy = mergeDataState(current, normalizeExportPayload(legacyPayload));

    const modernPayload = buildExportPayload({
      accounts: [{ id: 'acc1', createdAt: 10 }],
      categories: [],
      transactions: [{ id: 'txn1', createdAt: 10 }],
      installmentPlans: [],
      tombstones: [],
    }, { device: { id: 'dev1', name: 'x' } });
    const fromModern = mergeDataState(current, normalizeExportPayload(modernPayload));

    expect(fromLegacy.accounts.map(a => a.id)).toEqual(fromModern.accounts.map(a => a.id));
    expect(fromLegacy.transactions.map(t => t.id)).toEqual(fromModern.transactions.map(t => t.id));
    expect(fromLegacy.stats).toEqual(fromModern.stats);
  });
});
