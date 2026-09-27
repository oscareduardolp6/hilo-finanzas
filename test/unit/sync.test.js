import { describe, it, expect } from 'vitest';
import {
  buildExportPayload,
  normalizeExportPayload,
  parseExportText,
  bytesToBase64,
  base64ToBytes,
  gzipString,
  gunzipBytes,
  replaceDataState,
  EXPORT_TEXT_PREFIX,
} from '../../hilo-finanzas.jsx';

const emptyState = { accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] };

function stateWith(overrides) {
  return { ...emptyState, ...overrides };
}

/* ------------------------------------------------------------------ */
/* buildExportPayload                                                  */
/* ------------------------------------------------------------------ */

describe('buildExportPayload', () => {
  it('siempre la foto completa (partial:false, since:null)', () => {
    const state = stateWith({
      accounts: [{ id: 'a', createdAt: 1 }],
      transactions: [{ id: 't', createdAt: 1 }],
      tombstones: [{ id: 'x', deletedAt: 1 }],
    });
    const p = buildExportPayload(state);
    expect(p.app).toBe('hilo-finanzas');
    expect(p.partial).toBe(false);
    expect(p.since).toBe(null);
    expect(p.device).toBe(null);
    expect(p.data.accounts).toHaveLength(1);
    expect(p.data.tombstones).toHaveLength(1);
    expect(typeof p.exportedAt).toBe('string');
  });

  it('copia el device tal cual', () => {
    const p = buildExportPayload(emptyState, { device: { id: 'dev1', name: 'Laptop' } });
    expect(p.device).toEqual({ id: 'dev1', name: 'Laptop' });
  });
});

/* ------------------------------------------------------------------ */
/* normalizeExportPayload                                              */
/* ------------------------------------------------------------------ */

describe('normalizeExportPayload', () => {
  const good = () => ({
    app: 'hilo-finanzas',
    schema: 1,
    data: { accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] },
  });

  it('rechaza lo que no es un export de Hilo', () => {
    expect(() => normalizeExportPayload(null)).toThrow(/no parece un export de Hilo/i);
    expect(() => normalizeExportPayload({ app: 'otra-cosa', data: {} })).toThrow(/no parece un export de Hilo/i);
    expect(() => normalizeExportPayload({ app: 'hilo-finanzas' })).toThrow(/no parece un export de Hilo/i);
  });

  it('rechaza si falta alguna colección o no es array', () => {
    const bad = good();
    delete bad.data.transactions;
    expect(() => normalizeExportPayload(bad)).toThrow(/incompleto o dañado/i);

    const bad2 = good();
    bad2.data.accounts = 'no soy array';
    expect(() => normalizeExportPayload(bad2)).toThrow(/incompleto o dañado/i);
  });

  it('export viejo (pre-delta) -> device:null, partial:false, since:null, tombstones:[]', () => {
    const old = good();
    delete old.data.tombstones;
    const norm = normalizeExportPayload(old);
    expect(norm.device).toBe(null);
    expect(norm.partial).toBe(false);
    expect(norm.since).toBe(null);
    expect(norm.tombstones).toEqual([]);
  });

  it('conserva device / partial / since del envelope nuevo', () => {
    const p = good();
    p.device = { id: 'd1', name: 'Tel' };
    p.partial = true;
    p.since = 12345;
    p.exportedAt = '2026-01-01T00:00:00.000Z';
    const norm = normalizeExportPayload(p);
    expect(norm.device).toEqual({ id: 'd1', name: 'Tel' });
    expect(norm.partial).toBe(true);
    expect(norm.since).toBe(12345);
    expect(norm.exportedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('device sin id string -> null', () => {
    const p = good();
    p.device = { name: 'sin id' };
    expect(normalizeExportPayload(p).device).toBe(null);
  });
});

/* ------------------------------------------------------------------ */
/* parseExportText / base64 / gzip                                    */
/* ------------------------------------------------------------------ */

describe('parseExportText', () => {
  const payload = {
    app: 'hilo-finanzas',
    schema: 1,
    data: { accounts: [{ id: 'a' }], categories: [], transactions: [], installmentPlans: [], tombstones: [] },
  };

  it('acepta JSON plano', async () => {
    const norm = await parseExportText(JSON.stringify(payload));
    expect(norm.accounts).toEqual([{ id: 'a' }]);
  });

  it('acepta texto comprimido con prefijo hilo1:', async () => {
    const bytes = await gzipString(JSON.stringify(payload));
    const text = EXPORT_TEXT_PREFIX + bytesToBase64(bytes);
    const norm = await parseExportText(text);
    expect(norm.accounts).toEqual([{ id: 'a' }]);
  });

  it('cadena vacía -> error', async () => {
    await expect(parseExportText('   ')).rejects.toThrow(/nada que leer/i);
  });

  it('JSON malformado -> error legible', async () => {
    await expect(parseExportText('{ esto no es json')).rejects.toThrow(/no parece un export de Hilo/i);
  });

  it('prefijo hilo1: con base64 corrupto -> error específico', async () => {
    await expect(parseExportText(EXPORT_TEXT_PREFIX + 'no-es-base64-gzip!!!')).rejects.toThrow(/texto comprimido/i);
  });
});

describe('base64 <-> bytes', () => {
  it('round-trip de bytes arbitrarios', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255, 42]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('gzip <-> gunzip', () => {
  it('round-trip de un JSON grande', async () => {
    const big = JSON.stringify({ list: Array.from({ length: 500 }, (_, i) => ({ id: 'txn_' + i, amount: i })) });
    const back = await gunzipBytes(await gzipString(big));
    expect(back).toBe(big);
  });

  it('gunzip de basura rechaza', async () => {
    await expect(gunzipBytes(new Uint8Array([1, 2, 3, 4]))).rejects.toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* replaceDataState                                                    */
/* ------------------------------------------------------------------ */

describe('replaceDataState', () => {
  it('reemplazo total', () => {
    const out = replaceDataState({
      accounts: [{ id: 'a' }], categories: [{ id: 'c' }],
      transactions: [{ id: 't' }], installmentPlans: [{ id: 'p' }],
      tombstones: [{ id: 'x', deletedAt: 1 }],
    });
    expect(out.accounts).toHaveLength(1);
    expect(out.tombstones).toHaveLength(1);
  });

  it('colecciones ausentes -> []', () => {
    const out = replaceDataState({});
    // `benefitPrograms` se agregó después que las otras 5: cambio de
    // comportamiento deliberado, no un test desactualizado (ver CLAUDE.md).
    expect(out).toEqual({ accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [], benefitPrograms: [] });
  });
});
