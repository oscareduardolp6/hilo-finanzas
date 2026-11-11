/* El respaldo por correo solo sirve si la app lo puede restaurar: por eso el
   adjunto se lee aquí con el mismo `parseExportText` que usa Ajustes → Respaldo. */

import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseExportText } from '../../src/shared/domain/export-payload';
import { buildBackupPayload, decodeStateDocument, emailBody, emailSubject, encodeBackup, summarize } from './lib.mjs';

const NOW = new Date('2026-11-10T09:00:00Z'); // 03:00 en Ciudad de México

const tx = (id, date) => ({
  id, type: 'expense', accountId: 'a1', categoryId: 'c1', amount: 10, date, description: id, createdAt: 1,
});

const state = {
  accounts: [{ id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#000', initialBalance: 0 }],
  categories: [{ id: 'c1', name: 'Comida', icon: 'UtensilsCrossed', color: '#000', type: 'expense' }],
  transactions: [tx('t1', '2026-09-30'), tx('t2', '2026-10-15'), tx('t3', '2026-11-09'), tx('t4', '2026-11-08')],
  installmentPlans: [],
  tombstones: [],
  benefitPrograms: [],
};

describe('decodeStateDocument', () => {
  it('lee el documento comprimido que escribe firestoreStateRepository', () => {
    const raw = { blob: gzipSync(JSON.stringify(state)) };
    expect(decodeStateDocument(raw)).toEqual(state);
  });

  it('lee el formato viejo, sin comprimir', () => {
    expect(decodeStateDocument({ ...state })).toEqual(state);
  });

  it('falla si no hay documento o no tiene la forma esperada', () => {
    expect(() => decodeStateDocument(null)).toThrow('no existe');
    expect(() => decodeStateDocument({ foo: 1 })).toThrow('forma esperada');
  });
});

describe('el adjunto', () => {
  it('se restaura con el parser de la app y trae todo', async () => {
    const text = encodeBackup(buildBackupPayload(state, NOW));

    expect(text.startsWith('hilo1:')).toBe(true);
    const incoming = await parseExportText(text);
    expect(incoming.transactions).toEqual(state.transactions);
    expect(incoming.accounts).toEqual(state.accounts);
    expect(incoming.partial).toBe(false);
    expect(incoming.exportedAt).toBe(NOW.toISOString());
  });
});

describe('el resumen del correo', () => {
  it('cuenta los movimientos por mes y encuentra el más reciente', () => {
    const summary = summarize(state, NOW);

    expect(summary.today).toBe('2026-11-10');
    expect(summary.totalTransactions).toBe(4);
    expect(summary.perMonth).toEqual({ '2026-09': 1, '2026-10': 1, '2026-11': 2 });
    expect(summary.latest).toBe('2026-11-09');
    expect(summary.stale).toBe(false);
    expect(emailSubject(summary)).toBe('Respaldo de Hilo — 2026-11-10 (4 movimientos)');
  });

  it('avisa si el movimiento más reciente es viejo, como cuando se perdieron octubre y noviembre', () => {
    const viejo = { ...state, transactions: [tx('t1', '2026-09-27')] };
    const summary = summarize(viejo, NOW);

    expect(summary.stale).toBe(true);
    expect(emailSubject(summary).startsWith('⚠️')).toBe(true);
    expect(emailBody(summary, 'x.json')).toContain('2026-09-27 (hace 44 días)');
  });

  it('una fecha futura (un gasto programado) no cuenta como el más reciente', () => {
    const conFuturo = { ...state, transactions: [tx('t1', '2026-11-09'), tx('t2', '2026-12-01')] };
    expect(summarize(conFuturo, NOW).latest).toBe('2026-11-09');
  });
});
