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
