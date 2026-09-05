/* La partición activos/pagados. Estaba duplicada literal entre las dos vistas,
   así que no la cubría ningún test directo: se comprobaba por el DOM. */

import { describe, it, expect } from 'vitest';
import type { InstallmentPlan, PlanProgress, Transaction } from '../../../shared/domain/types';
import { groupPlansByStatus, planPayments } from './grouping';

const plan = (id: string, createdAt: number): InstallmentPlan => ({
  id, description: id, totalAmount: 900, installmentsCount: 6,
  categoryId: 'compras', startDate: '2026-01-01', createdAt,
});

const progress = (isPaidOff: boolean): PlanProgress => ({
  paid: 0, per: 150, installmentsPaid: 0, remaining: 900, pct: 0, isPaidOff,
});

describe('groupPlansByStatus', () => {
  it('separa pagados de activos', () => {
    const a = plan('a', 1);
    const b = plan('b', 2);

    const { active, completed } = groupPlansByStatus([a, b], { a: progress(false), b: progress(true) });

    expect(active).toEqual([a]);
    expect(completed).toEqual([b]);
  });

  it('ordena cada grupo del más reciente al más viejo', () => {
    const viejo = plan('viejo', 1);
    const nuevo = plan('nuevo', 99);

    const { active } = groupPlansByStatus([viejo, nuevo], {});

    expect(active.map(p => p.id)).toEqual(['nuevo', 'viejo']);
  });

  it('un plan sin avance calculado cuenta como activo', () => {
    // Sin datos de avance no se puede afirmar que esté pagado; esconderlo sería
    // peor que mostrarlo de más.
    const { active, completed } = groupPlansByStatus([plan('a', 1)], {});

    expect(active).toHaveLength(1);
    expect(completed).toEqual([]);
  });

  it('no muta la colección que recibe', () => {
    const plans = [plan('a', 1), plan('b', 2)];
    const copia = [...plans];
    groupPlansByStatus(plans, {});
    expect(plans).toEqual(copia);
  });
});

describe('planPayments', () => {
  const abono = (id: string, date: string, planId: string | null) => ({
    id, type: 'transfer', date, amount: 75, description: '',
    fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: true, installmentPlanId: planId,
  } as Transaction);

  it('devuelve solo los abonos del plan, del más reciente al más viejo', () => {
    const txns = [
      abono('t1', '2026-01-10', 'msi_1'),
      abono('t2', '2026-03-05', 'msi_1'),
      abono('t3', '2026-02-01', 'otro'),
    ];

    expect(planPayments('msi_1', txns).map(t => t.id)).toEqual(['t2', 't1']);
  });

  it('un movimiento sin plan nunca cuenta', () => {
    const ingreso = {
      id: 'i1', type: 'income', date: '2026-01-01', amount: 10, description: '',
      accountId: 'a1', categoryId: 'c1',
    } as Transaction;

    expect(planPayments('msi_1', [ingreso])).toEqual([]);
  });
});
