import { describe, it, expect } from 'vitest';
import {
  computePlanProgress,
  normalizeExportPayload,
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
});
