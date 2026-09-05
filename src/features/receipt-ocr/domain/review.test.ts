/* Las derivaciones de la hoja de revisión. Estaban inline entre el JSX, donde
   no se podían probar sin montar el modal entero. */

import { describe, it, expect } from 'vitest';
import { computeReviewTotals } from './review';
import type { ReceiptDiscount, ReceiptRow } from './draft';

const row = (over: Partial<ReceiptRow> = {}): ReceiptRow => ({
  id: 'r1', description: 'Leche', amount: 45.5, quantity: '', categoryId: 'comida',
  accountId: null, included: true, ...over,
});

const discount = (over: Partial<ReceiptDiscount> = {}): ReceiptDiscount => ({
  id: 'd1', label: 'Ahorro', amount: 10, accountId: null, included: true, ...over,
});

const totals = (over: Partial<Parameters<typeof computeReviewTotals>[0]> = {}) =>
  computeReviewTotals({
    rows: [], discounts: [], primaryAccountId: 'a1', originAccountId: '',
    accountModes: {}, ticketTotal: 0, ...over,
  });

describe('computeReviewTotals', () => {
  it('suma solo lo incluido, y el neto descuenta', () => {
    const t = totals({
      rows: [row({ id: 'r1', amount: 100 }), row({ id: 'r2', amount: 50, included: false })],
      discounts: [discount({ amount: 30 })],
    });

    expect(t.sumRows).toBe(100);
    expect(t.sumDiscounts).toBe(30);
    expect(t.net).toBe(70);
    expect(t.totalCount).toBe(2);
  });

  it('los montos editados llegan como string y se suman igual', () => {
    expect(totals({ rows: [row({ amount: '12.50' })] }).sumRows).toBe(12.5);
  });

  it('un renglón sin cuenta propia cuenta para la principal', () => {
    const t = totals({
      rows: [row({ id: 'r1' }), row({ id: 'r2', accountId: 'a2' })],
      primaryAccountId: 'a1',
    });

    expect(t.usedAccountIds).toEqual(['a1', 'a2']);
  });

  it('el descuadre avisa a partir de medio peso, no antes', () => {
    expect(totals({ rows: [row({ amount: 100 })], ticketTotal: 100.4 }).mismatch).toBe(false);
    expect(totals({ rows: [row({ amount: 100 })], ticketTotal: 102 }).mismatch).toBe(true);
    // Sin total impreso no hay nada contra qué contrastar.
    expect(totals({ rows: [row({ amount: 100 })], ticketTotal: 0 }).mismatch).toBe(false);
  });

  it('no se puede guardar sin nada que agregar, ni sin cuenta principal', () => {
    expect(totals().canSave).toBe(false);
    expect(totals({ rows: [row()], primaryAccountId: '' }).canSave).toBe(false);
    expect(totals({ rows: [row()] }).canSave).toBe(true);
  });

  it('con una cuenta en modo transferencia hace falta la de origen', () => {
    const enTransferencia = { rows: [row()], accountModes: { a1: true } };

    expect(totals(enTransferencia).anyTransfer).toBe(true);
    expect(totals(enTransferencia).canSave).toBe(false);
    expect(totals({ ...enTransferencia, originAccountId: 'a2' }).canSave).toBe(true);
  });
});
