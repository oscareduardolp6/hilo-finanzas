/* De ticket leído a borrador del formulario: un movimiento por lo pagado,
   con un renglón por artículo y los descuentos como ahorro. */

import { describe, it, expect } from 'vitest';
import type { Account, Category } from '../../../shared/domain/types';
import { computeBreakdownSummary } from '../../transactions/domain/breakdown';
import type { ReceiptDraft, ReceiptRow } from './draft';
import { dominantCategoryId, receiptToFormDraft } from './to-form';

const cuenta: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#111', initialBalance: 0 };
const comida: Category = { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#111', type: 'expense' };
const hogar: Category = { id: 'hogar', name: 'Hogar', icon: 'Home', color: '#222', type: 'expense' };

const row = (over: Partial<ReceiptRow>): ReceiptRow => ({
  id: 'r', description: 'X', amount: 10, quantity: '', unitPrice: '', categoryId: 'comida',
  accountId: null, included: true, ...over,
});

const draft = (over: Partial<ReceiptDraft> = {}): ReceiptDraft => ({
  store: 'HEB', date: '2026-09-01', ticketTotal: 0, rows: [], discounts: [], ...over,
});

let n = 0;
const opts = { accounts: [cuenta], categories: [comida, hogar], newId: (p?: string) => `${p}_${++n}` };

describe('receiptToFormDraft', () => {
  it('lo pagado es el total impreso, y los artículos van a precio de lista', () => {
    n = 0;
    const form = receiptToFormDraft(draft({
      ticketTotal: 208,
      rows: [row({ description: 'A', amount: 120 }), row({ description: 'B', amount: 100 })],
      discounts: [{ id: 'd', label: 'Ahorro', amount: 12, accountId: null, included: true }],
    }), opts);

    expect(form).toMatchObject({ amount: '208', store: 'HEB', description: 'HEB', date: '2026-09-01', accountId: 'a1' });
    expect(form.breakdown!.items.map(i => i.amount)).toEqual(['120', '100']);
    expect(form.breakdown!.discounts[0]).toMatchObject({ id: 'bdisc_3', label: 'Ahorro', amount: '12', benefitProgramId: null });
    // 120 + 100 − 12 = 208: el desglose cuadra sin "Sin especificar".
    expect(computeBreakdownSummary(208, form.breakdown!).unspecified).toBeCloseTo(0, 5);
  });

  it('sin total impreso, lo pagado se deriva de los renglones', () => {
    const form = receiptToFormDraft(draft({
      rows: [row({ amount: 50 }), row({ amount: 25.5 })],
      discounts: [{ id: 'd', label: 'Promo', amount: 5.5, accountId: null, included: true }],
    }), opts);

    expect(form.amount).toBe('70');
  });

  it('la categoría del movimiento es la que se lleva más dinero; esos renglones la heredan', () => {
    const form = receiptToFormDraft(draft({
      rows: [
        row({ categoryId: 'hogar', amount: 300 }),
        row({ categoryId: 'comida', amount: 100 }),
        row({ categoryId: 'comida', amount: 50 }),
      ],
    }), opts);

    expect(form.categoryId).toBe('hogar');
    expect(form.breakdown!.items.map(i => i.categoryId)).toEqual([null, 'comida', 'comida']);
  });

  it('cantidad y precio unitario pasan tal cual; los renglones en cero no', () => {
    const form = receiptToFormDraft(draft({
      rows: [row({ amount: 45.5, quantity: '2', unitPrice: '22.75' }), row({ amount: 0 })],
    }), opts);

    expect(form.breakdown!.items).toHaveLength(1);
    expect(form.breakdown!.items[0]).toMatchObject({ quantity: '2', unitPrice: '22.75', amount: '45.5' });
  });

  it('un ticket sin nada legible no abre desglose', () => {
    const form = receiptToFormDraft(draft({ store: '' }), opts);

    expect(form.breakdown).toBeNull();
    expect(form.amount).toBe('');
    expect(form.description).toBe('Ticket');
  });

  it('si los artículos suman más que lo pagado, el desglose no cuadra y el formulario no deja guardar', () => {
    // Un renglón repetido entre dos fotos que se le escapó al modelo.
    const form = receiptToFormDraft(draft({
      ticketTotal: 100,
      rows: [row({ amount: 60 }), row({ amount: 60 })],
    }), opts);

    expect(computeBreakdownSummary(100, form.breakdown!).isBalanced).toBe(false);
  });
});

describe('dominantCategoryId', () => {
  it('sin renglones con categoría, el fallback', () => {
    expect(dominantCategoryId(draft(), 'comida')).toBe('comida');
  });
});
