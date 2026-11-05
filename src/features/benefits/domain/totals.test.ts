import { describe, it, expect } from 'vitest';
import type { BenefitProgram, Transaction } from '../../../shared/domain/types';
import { computeBenefitTotals } from './totals';

const program = (id: string): BenefitProgram => ({ id, name: id, icon: 'Gift', color: '#000' });

const income = (id: string, amount: number, date: string, benefitProgramId: string | null): Transaction => ({
  id, type: 'income', date, amount, description: '', accountId: 'a1', categoryId: 'descuentos', benefitProgramId,
});

describe('computeBenefitTotals', () => {
  it('suma los ingresos etiquetados, por programa', () => {
    const txns = [
      income('t1', 20, '2026-01-05', 'amex'),
      income('t2', 15, '2026-01-10', 'amex'),
      income('t3', 50, '2026-01-10', 'heb'),
    ];

    const totals = computeBenefitTotals(txns, [program('amex'), program('heb')]);

    expect(totals).toEqual({ amex: 35, heb: 50 });
  });

  it('ignora ingresos sin programa y movimientos que no son income', () => {
    const txns: Transaction[] = [
      income('t1', 20, '2026-01-05', null),
      {
        id: 't2', type: 'expense', date: '2026-01-05', amount: 100, description: '',
        accountId: 'a1', categoryId: 'comida',
      } as Transaction,
    ];

    expect(computeBenefitTotals(txns, [program('amex')])).toEqual({ amex: 0 });
  });

  it('ignora un benefitProgramId que ya no tiene programa (borrado)', () => {
    const txns = [income('t1', 20, '2026-01-05', 'ya_borrado')];

    expect(computeBenefitTotals(txns, [program('amex')])).toEqual({ amex: 0 });
  });

  it('con sinceIso, solo cuenta desde esa fecha (inclusive)', () => {
    const txns = [
      income('t1', 20, '2026-01-01', 'amex'),
      income('t2', 30, '2026-02-01', 'amex'),
    ];

    expect(computeBenefitTotals(txns, [program('amex')], '2026-02-01')).toEqual({ amex: 30 });
  });
});

describe('computeBenefitTotals con descuentos del desglose', () => {
  it('suma el descuento ligado a un programa como ahorro, junto a los ingresos', () => {
    const cafe: Transaction = {
      id: 'sb', type: 'expense', date: '2026-01-12', amount: 174, description: 'Starbucks',
      accountId: 'a1', categoryId: 'cafe',
      breakdown: {
        items: [],
        discounts: [
          { id: 'd1', label: 'Promo Amex', amount: 26, categoryId: null, benefitProgramId: 'amex' },
          { id: 'd2', label: 'Sin programa', amount: 9, categoryId: null, benefitProgramId: null },
        ],
      },
    };
    const totals = computeBenefitTotals([cafe, income('t1', 20, '2026-01-05', 'amex')], [program('amex')]);
    expect(totals).toEqual({ amex: 46 });
  });

  it('respeta el corte de fecha', () => {
    const viejo: Transaction = {
      id: 'v', type: 'expense', date: '2025-06-01', amount: 100, description: '', accountId: 'a1', categoryId: 'c',
      breakdown: { items: [], discounts: [{ id: 'd', label: '', amount: 10, categoryId: null, benefitProgramId: 'amex' }] },
    };
    expect(computeBenefitTotals([viejo], [program('amex')], '2026-01-01')).toEqual({ amex: 0 });
  });
});
