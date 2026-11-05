/* El desglose de un ticket. Los dos ejemplos de la tarea son los casos base:
   El Sato (desglose parcial: lo no desglosado queda "sin especificar") y
   Starbucks (el descuento de Amex como renglón propio, que resta de Café). */

import { describe, it, expect } from 'vitest';
import type { BreakdownDiscount, BreakdownItem, Transaction, TransactionBreakdown } from '../../../shared/domain/types';
import {
  breakdownSearchText, breakdownToDraft, computeBreakdownSummary, computeCategoryPortions,
  computeTransactionSavings, draftToBreakdown, newItemDraft, patchItemDraft,
} from './breakdown';
import { toTransaction } from './to-transaction';

const item = (id: string, amount: number, extra: Partial<BreakdownItem> = {}): BreakdownItem => ({
  id, description: id, amount, quantity: null, unitPrice: null, categoryId: null, size: null, brand: null, ...extra,
});

const discount = (id: string, amount: number, extra: Partial<BreakdownDiscount> = {}): BreakdownDiscount => ({
  id, label: id, amount, categoryId: null, benefitProgramId: null, ...extra,
});

const gasto = (amount: number, breakdown: TransactionBreakdown | null, categoryId = 'restaurantes'): Transaction => ({
  id: 'g', type: 'expense', date: '2026-03-02', amount, description: '', accountId: 'a1', categoryId, breakdown,
});

/** Suma de porciones por categoría, para leer los asserts de un vistazo. */
const porCategoria = (t: Transaction) =>
  computeCategoryPortions(t).reduce<Record<string, number>>((acc, p) => {
    acc[p.categoryId ?? '∅'] = (acc[p.categoryId ?? '∅'] ?? 0) + p.amount;
    return acc;
  }, {});

describe('El Sato: desglose parcial', () => {
  const sato = gasto(5000, { items: [item('Nigiris', 1000), item('Bebidas', 2000)], discounts: [] });

  it('lo no desglosado queda como "sin especificar"', () => {
    expect(computeBreakdownSummary(5000, sato.type === 'expense' ? sato.breakdown! : { items: [], discounts: [] }))
      .toMatchObject({ itemsTotal: 3000, unspecified: 2000, subtotal: 5000, isBalanced: true });
  });

  it('todo cae en la categoría del movimiento y suma el total', () => {
    expect(porCategoria(sato)).toEqual({ restaurantes: 5000 });
  });

  it('un renglón con otra categoría (lo que se invitó) se separa', () => {
    const conRegalo = gasto(5000, {
      items: [item('Nigiris', 1000), item('Lo del amigo', 1500, { categoryId: 'regalos' })], discounts: [],
    });
    expect(porCategoria(conRegalo)).toEqual({ restaurantes: 3500, regalos: 1500 });
  });

  it('si los renglones se pasan del total, no cuadra', () => {
    expect(computeBreakdownSummary(5000, { items: [{ amount: 3000 }, { amount: 2500 }], discounts: [] }))
      .toMatchObject({ unspecified: -500, isBalanced: false });
  });
});

describe('Starbucks: descuento como renglón propio', () => {
  const starbucks = gasto(174, {
    items: [item('Latte', 200)],
    discounts: [discount('Promo Amex', 26, { benefitProgramId: 'amex' })],
  }, 'cafe');

  it('cuadra: $200 de consumo − $26 de descuento = $174 pagados', () => {
    expect(computeBreakdownSummary(174, { items: [{ amount: 200 }], discounts: [{ amount: 26 }] }))
      .toMatchObject({ subtotal: 200, unspecified: 0, discountsTotal: 26, isBalanced: true });
  });

  it('Café suma lo pagado, no el precio de lista', () => {
    expect(porCategoria(starbucks)).toEqual({ cafe: 174 });
  });

  it('el ahorro es la suma de descuentos', () => {
    expect(computeTransactionSavings(starbucks)).toBe(26);
  });
});

describe('sin desglose', () => {
  it('una sola porción: lo de siempre', () => {
    expect(computeCategoryPortions(gasto(250, null, 'comida'))).toEqual([{ categoryId: 'comida', amount: 250 }]);
  });

  it('un registro viejo sin el campo se lee igual', () => {
    const viejo = { id: 'v', type: 'expense', date: '2025-01-01', amount: 99, description: '', accountId: 'a1', categoryId: 'comida' } as Transaction;
    expect(computeCategoryPortions(viejo)).toEqual([{ categoryId: 'comida', amount: 99 }]);
    expect(computeTransactionSavings(viejo)).toBe(0);
  });

  it('un ingreso o una transferencia sin marcar no reparten gasto', () => {
    const ingreso = { id: 'i', type: 'income', date: '2026-01-01', amount: 10, description: '', accountId: 'a1', categoryId: 'x' } as Transaction;
    const transferencia = { id: 't', type: 'transfer', date: '2026-01-01', amount: 10, description: '', fromAccountId: 'a', toAccountId: 'b', taggedAsExpense: false } as Transaction;
    expect(computeCategoryPortions(ingreso)).toEqual([]);
    expect(computeCategoryPortions(transferencia)).toEqual([]);
  });
});

describe('búsqueda', () => {
  it('incluye conceptos, marcas y descuentos', () => {
    const t = gasto(100, { items: [item('Nigiri salmón', 60, { brand: 'Kirkland' })], discounts: [discount('Promo Amex', 5)] });
    expect(breakdownSearchText(t)).toEqual(['Nigiri salmón', 'Kirkland', 'Promo Amex']);
  });
});

describe('borrador', () => {
  it('cantidad × unitario calcula el total', () => {
    const a = patchItemDraft(newItemDraft('x'), 'quantity', '3');
    const b = patchItemDraft(a, 'unitPrice', '45.5');
    expect(b).toMatchObject({ quantity: '3', unitPrice: '45.5', amount: '136.5' });
  });

  it('teclear el total con cantidad recalcula el unitario', () => {
    const a = patchItemDraft(newItemDraft('x'), 'quantity', '4');
    expect(patchItemDraft(a, 'amount', '100')).toMatchObject({ unitPrice: '25', amount: '100' });
  });

  it('sin cantidad, el total se queda como se tecleó', () => {
    expect(patchItemDraft(newItemDraft('x'), 'amount', '80')).toMatchObject({ amount: '80', unitPrice: '' });
  });

  it('ida y vuelta: persistido → borrador → persistido', () => {
    const b: TransactionBreakdown = {
      items: [item('Leche', 48, { quantity: 2, unitPrice: 24, size: '1L', brand: 'Lala', categoryId: 'super' })],
      discounts: [discount('Cupón', 5, { benefitProgramId: 'heb' })],
    };
    expect(draftToBreakdown(breakdownToDraft(b))).toEqual(b);
  });

  it('vacíos a null, textos recortados', () => {
    const d = { ...newItemDraft('x'), description: '  Pan  ', amount: '30', size: '  ' };
    expect(draftToBreakdown({ items: [d], discounts: [] })!.items[0]).toEqual(item('x', 30, { description: 'Pan' }));
  });
});

describe('toTransaction con desglose', () => {
  const desglose = { items: [{ ...newItemDraft('i1'), amount: '100' }], discounts: [] };

  it('un gasto lo guarda', () => {
    const t = toTransaction('expense', { date: '2026-01-01', description: '', amount: '100', breakdown: desglose }, '2026-01-01');
    expect(t).toMatchObject({ breakdown: { items: [{ id: 'i1', amount: 100 }], discounts: [] } });
  });

  it('un abono de MSI lo descarta', () => {
    const t = toTransaction('expense', { date: '2026-01-01', description: '', amount: '100', installmentPlanId: 'p1', breakdown: desglose }, '2026-01-01');
    expect(t).toMatchObject({ breakdown: null });
  });

  it('una transferencia solo lo guarda marcada como gasto', () => {
    const base = { date: '2026-01-01', description: '', amount: '100', fromAccountId: 'a', toAccountId: 'b', categoryId: 'c', breakdown: desglose };
    expect(toTransaction('transfer', { ...base, taggedAsExpense: false }, '2026-01-01')).toMatchObject({ breakdown: null });
    expect(toTransaction('transfer', { ...base, taggedAsExpense: true }, '2026-01-01'))
      .toMatchObject({ breakdown: { items: [{ id: 'i1' }] } });
  });

  it('sin desglose se escribe null explícito, para que editar lo borre', () => {
    const t = toTransaction('expense', { date: '2026-01-01', description: '', amount: '100', breakdown: null }, '2026-01-01');
    expect('breakdown' in t && t.breakdown).toBe(null);
  });
});
