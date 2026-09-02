import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildExportPayload,
  normalizeExportPayload,
  parseExportText,
  bytesToBase64,
  base64ToBytes,
  gzipString,
  gunzipBytes,
  mergeCollection,
  mergeTombstones,
  mergeDataState,
  replaceDataState,
  EXPORT_TEXT_PREFIX,
  SYNC_SKEW_MARGIN_MS,
  TOMBSTONE_TTL_MS,
} from '../../hilo-finanzas.jsx';

afterEach(() => vi.useRealTimers());

const emptyState = { accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] };

function stateWith(overrides) {
  return { ...emptyState, ...overrides };
}

/* ------------------------------------------------------------------ */
/* buildExportPayload                                                  */
/* ------------------------------------------------------------------ */

describe('buildExportPayload', () => {
  it('sin opciones -> foto completa (partial:false, since:null)', () => {
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

  it('con `since` finito -> delta: sólo registros con recordStamp > since - margen', () => {
    const since = 1_000_000;
    const state = stateWith({
      transactions: [
        { id: 'viejo', updatedAt: since - SYNC_SKEW_MARGIN_MS - 1 },       // fuera
        { id: 'enElMargen', updatedAt: since - SYNC_SKEW_MARGIN_MS + 1 },  // dentro (margen anti-desfase)
        { id: 'nuevo', updatedAt: since + 5000 },                          // dentro
      ],
      tombstones: [
        { id: 'tExcl', deletedAt: since - SYNC_SKEW_MARGIN_MS - 1 },
        { id: 'tIncl', deletedAt: since + 1 },
      ],
    });
    const p = buildExportPayload(state, { since });
    expect(p.partial).toBe(true);
    expect(p.since).toBe(since);
    expect(p.data.transactions.map(t => t.id)).toEqual(['enElMargen', 'nuevo']);
    expect(p.data.tombstones.map(t => t.id)).toEqual(['tIncl']);
  });

  it('delta usa recordStamp (createdAt si no hay updatedAt)', () => {
    const since = 1_000_000;
    const state = stateWith({
      accounts: [
        { id: 'a1', createdAt: since - SYNC_SKEW_MARGIN_MS - 10 },
        { id: 'a2', createdAt: since + 10 },
      ],
    });
    expect(buildExportPayload(state, { since }).data.accounts.map(a => a.id)).toEqual(['a2']);
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
/* mergeCollection                                                     */
/* ------------------------------------------------------------------ */

describe('mergeCollection', () => {
  const noTombstones = new Map();

  it('registro nuevo -> added++', () => {
    const res = mergeCollection([{ id: 'a', updatedAt: 1 }], [{ id: 'b', updatedAt: 1 }], noTombstones);
    expect(res.added).toBe(1);
    expect(res.updated).toBe(0);
    expect(res.list.map(r => r.id).sort()).toEqual(['a', 'b']);
  });

  it('entrante más nuevo -> reemplaza y updated++', () => {
    const res = mergeCollection([{ id: 'a', updatedAt: 1, v: 'old' }], [{ id: 'a', updatedAt: 2, v: 'new' }], noTombstones);
    expect(res.updated).toBe(1);
    expect(res.list[0].v).toBe('new');
  });

  it('empate de recordStamp -> gana el entrante pero NO cuenta como updated', () => {
    const res = mergeCollection([{ id: 'a', updatedAt: 5, v: 'local' }], [{ id: 'a', updatedAt: 5, v: 'incoming' }], noTombstones);
    expect(res.updated).toBe(0);
    expect(res.list[0].v).toBe('incoming');
  });

  it('entrante más viejo -> se queda el actual', () => {
    const res = mergeCollection([{ id: 'a', updatedAt: 10, v: 'local' }], [{ id: 'a', updatedAt: 3, v: 'incoming' }], noTombstones);
    expect(res.updated).toBe(0);
    expect(res.list[0].v).toBe('local');
  });

  it('tombstone posterior a la última edición -> excluye y removed++', () => {
    const tomb = new Map([['a', 100]]);
    const res = mergeCollection([{ id: 'a', updatedAt: 50 }], [], tomb);
    expect(res.removed).toBe(1);
    expect(res.list).toEqual([]);
  });

  it('tombstone anterior a la edición -> el registro sobrevive', () => {
    const tomb = new Map([['a', 10]]);
    const res = mergeCollection([{ id: 'a', updatedAt: 50 }], [], tomb);
    expect(res.removed).toBe(0);
    expect(res.list).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* mergeTombstones                                                     */
/* ------------------------------------------------------------------ */

describe('mergeTombstones', () => {
  it('dedupe por id quedándose el deletedAt mayor', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const now = Date.now();
    const out = mergeTombstones(
      [{ id: 'a', deletedAt: now - 1000 }],
      [{ id: 'a', deletedAt: now - 10 }, { id: 'b', deletedAt: now - 5 }],
    );
    const byId = Object.fromEntries(out.map(t => [t.id, t.deletedAt]));
    expect(byId.a).toBe(now - 10);
    expect(byId.b).toBe(now - 5);
  });

  it('descarta entradas más viejas que el TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const now = Date.now();
    const out = mergeTombstones(
      [{ id: 'viejo', deletedAt: now - TOMBSTONE_TTL_MS - 1000 }],
      [{ id: 'fresco', deletedAt: now - 1000 }],
    );
    expect(out.map(t => t.id)).toEqual(['fresco']);
  });

  it('ignora entradas sin id o sin deletedAt numérico', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const now = Date.now();
    const out = mergeTombstones(
      [{ deletedAt: now }, { id: 'x' }, { id: 'y', deletedAt: 'ayer' }, null],
      [{ id: 'ok', deletedAt: now - 1 }],
    );
    expect(out.map(t => t.id)).toEqual(['ok']);
  });
});

/* ------------------------------------------------------------------ */
/* mergeDataState / replaceDataState                                  */
/* ------------------------------------------------------------------ */

describe('mergeDataState', () => {
  it('funde las 4 colecciones + tombstones y agrega stats', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
    const now = Date.now();
    const current = stateWith({
      accounts: [{ id: 'acc1', updatedAt: now - 100, name: 'viejo' }],
      transactions: [{ id: 'txn1', updatedAt: now - 100 }, { id: 'txn2', updatedAt: now - 100 }],
    });
    const incoming = {
      accounts: [{ id: 'acc1', updatedAt: now, name: 'nuevo' }, { id: 'acc2', updatedAt: now }],
      categories: [], transactions: [], installmentPlans: [],
      tombstones: [{ id: 'txn2', deletedAt: now }],
    };
    const merged = mergeDataState(current, incoming);
    expect(merged.accounts.find(a => a.id === 'acc1').name).toBe('nuevo');
    expect(merged.accounts.map(a => a.id).sort()).toEqual(['acc1', 'acc2']);
    expect(merged.transactions.map(t => t.id)).toEqual(['txn1']); // txn2 con tombstone
    expect(merged.stats).toMatchObject({ added: 1, updated: 1, removed: 1 });
  });

  it('un payload parcial se funde igual que uno completo (la ausencia no borra)', () => {
    const current = stateWith({
      transactions: [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 1 }],
    });
    const partialIncoming = {
      accounts: [], categories: [], installmentPlans: [], tombstones: [],
      transactions: [{ id: 'b', updatedAt: 5, changed: true }], // 'a' no viene
    };
    const merged = mergeDataState(current, partialIncoming);
    expect(merged.transactions.map(t => t.id).sort()).toEqual(['a', 'b']);
    expect(merged.transactions.find(t => t.id === 'b').changed).toBe(true);
  });

  it('convergencia: merge(A, export(B)) y merge(B, export(A)) dan el mismo conjunto de ids', () => {
    const A = stateWith({ transactions: [{ id: 'x', updatedAt: 10 }, { id: 'y', updatedAt: 1 }] });
    const B = stateWith({ transactions: [{ id: 'y', updatedAt: 20 }, { id: 'z', updatedAt: 5 }] });
    const ab = mergeDataState(A, buildExportPayload(B).data);
    const ba = mergeDataState(B, buildExportPayload(A).data);
    expect(ab.transactions.map(t => t.id).sort()).toEqual(ba.transactions.map(t => t.id).sort());
    // last-write-wins determinista sobre 'y'
    expect(ab.transactions.find(t => t.id === 'y').updatedAt).toBe(20);
    expect(ba.transactions.find(t => t.id === 'y').updatedAt).toBe(20);
  });
});

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
    expect(out).toEqual({ accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] });
  });
});
