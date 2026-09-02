import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidIsoDate,
  buildReceiptDraft,
  scanReceipt,
} from '../../hilo-finanzas.jsx';

const expenseCategories = [
  { id: 'comida', name: 'Comida', type: 'expense' },
  { id: 'hogar', name: 'Hogar', type: 'expense' },
];

/* ------------------------------------------------------------------ */
/* isValidIsoDate                                                     */
/* ------------------------------------------------------------------ */

describe('isValidIsoDate', () => {
  it('YYYY-MM-DD válido', () => {
    expect(isValidIsoDate('2024-03-05')).toBe(true);
  });
  it('formatos inválidos', () => {
    expect(isValidIsoDate('2024-3-5')).toBe(false);
    expect(isValidIsoDate('05/03/2024')).toBe(false);
    expect(isValidIsoDate(20240305)).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* buildReceiptDraft                                                  */
/* ------------------------------------------------------------------ */

describe('buildReceiptDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('mapea lineItems a rows (amount = abs(listPrice), included:true, quantity string o vacío)', () => {
    const draft = buildReceiptDraft({
      store: '  Soriana ',
      date: '2026-09-10',
      ticketTotal: 350,
      lineItems: [
        { description: ' Leche ', listPrice: -45.5, quantity: 2, categoryId: 'comida' },
        { description: 'Foco', listPrice: 30, quantity: null, categoryId: 'hogar' },
      ],
      discounts: [],
    }, { expenseCategories });

    expect(draft.store).toBe('Soriana');
    expect(draft.date).toBe('2026-09-10');
    expect(draft.rows[0]).toMatchObject({ description: 'Leche', amount: 45.5, quantity: '2', categoryId: 'comida', accountId: null, included: true });
    expect(draft.rows[1]).toMatchObject({ description: 'Foco', quantity: '', categoryId: 'hogar' });
  });

  it('categoryId desconocido -> cae a la primera categoría de gasto', () => {
    const draft = buildReceiptDraft({
      store: '', date: '', ticketTotal: 0,
      lineItems: [{ description: 'X', listPrice: 10, categoryId: 'no-existe' }],
      discounts: [],
    }, { expenseCategories });
    expect(draft.rows[0].categoryId).toBe('comida');
  });

  it('descuentos: monto positivo y label con fallback', () => {
    const draft = buildReceiptDraft({
      store: '', date: '', ticketTotal: 0, lineItems: [],
      discounts: [{ label: '  ', amount: -12.3 }, { label: 'Promo 2x1', amount: 5 }],
    }, { expenseCategories });
    expect(draft.discounts[0]).toMatchObject({ label: 'Descuento', amount: 12.3, included: true });
    expect(draft.discounts[1]).toMatchObject({ label: 'Promo 2x1', amount: 5 });
  });

  it('fecha inválida -> hoy; fecha válida se respeta', () => {
    expect(buildReceiptDraft({ date: 'ayer', lineItems: [], discounts: [] }, { expenseCategories }).date).toBe('2026-09-15');
    expect(buildReceiptDraft({ date: '2025-01-02', lineItems: [], discounts: [] }, { expenseCategories }).date).toBe('2025-01-02');
  });

  it('invariante del ticket: sum(rows) - sum(descuentos) ≈ ticketTotal', () => {
    const draft = buildReceiptDraft({
      store: 'HEB', date: '2026-09-01', ticketTotal: 208,
      lineItems: [
        { description: 'A', listPrice: 120, categoryId: 'comida' },
        { description: 'B', listPrice: 100, categoryId: 'comida' },
      ],
      discounts: [{ label: 'Ahorro', amount: 12 }],
    }, { expenseCategories });
    const sumRows = draft.rows.reduce((s, r) => s + r.amount, 0);
    const sumDisc = draft.discounts.reduce((s, d) => s + d.amount, 0);
    expect(sumRows - sumDisc).toBeCloseTo(draft.ticketTotal, 2);
  });

  it('lineItems / discounts ausentes -> arrays vacíos', () => {
    const draft = buildReceiptDraft({ store: 'x', date: '2026-01-01', ticketTotal: 0 }, { expenseCategories });
    expect(draft.rows).toEqual([]);
    expect(draft.discounts).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* scanReceipt (fetch mockeado)                                       */
/* ------------------------------------------------------------------ */

describe('scanReceipt', () => {
  const args = {
    apiKey: 'sk-test',
    model: 'claude-haiku-4-5',
    image: { media_type: 'image/jpeg', data: 'QkFTRTY0' },
    expenseCategories,
  };

  afterEach(() => { vi.unstubAllGlobals(); });

  function mockFetch(impl) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }

  it('401 -> "La clave de API no es válida."', async () => {
    mockFetch(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(scanReceipt(args)).rejects.toThrow('La clave de API no es válida.');
  });

  it('429 -> límite de uso', async () => {
    mockFetch(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    await expect(scanReceipt(args)).rejects.toThrow(/límite de uso/i);
  });

  it('otro error HTTP -> incluye el código y el detalle del body', async () => {
    mockFetch(async () => ({ ok: false, status: 500, json: async () => ({ error: { message: 'overloaded' } }) }));
    await expect(scanReceipt(args)).rejects.toThrow(/código 500.*overloaded/i);
  });

  it('fetch que lanza (sin red) -> "No hay conexión para leer el ticket."', async () => {
    mockFetch(async () => { throw new TypeError('network'); });
    await expect(scanReceipt(args)).rejects.toThrow('No hay conexión para leer el ticket.');
  });

  it('respuesta OK sin bloque tool_use -> error de interpretación', async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'nada' }] }) }));
    await expect(scanReceipt(args)).rejects.toThrow(/No se pudo interpretar el ticket/i);
  });

  it('respuesta OK con tool_use -> devuelve block.input; el request fuerza la tool y manda la imagen', async () => {
    let sentBody;
    mockFetch(async (url, init) => {
      sentBody = JSON.parse(init.body);
      return {
        ok: true, status: 200,
        json: async () => ({ content: [{ type: 'tool_use', name: 'emit_receipt', input: { store: 'HEB', lineItems: [], discounts: [], ticketTotal: 0 } }] }),
      };
    });
    const out = await scanReceipt(args);
    expect(out).toMatchObject({ store: 'HEB' });
    expect(sentBody.tool_choice).toMatchObject({ type: 'tool', name: 'emit_receipt' });
    const imgBlock = sentBody.messages[0].content.find(c => c.type === 'image');
    expect(imgBlock.source.data).toBe('QkFTRTY0');
  });
});
