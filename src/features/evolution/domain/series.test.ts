import { describe, it, expect } from 'vitest';
import type { Account, Transaction } from '../../../shared/domain/types';
import { computeBalanceSeries, subtractMonthsIso } from './series';

const HOY = '2026-06-15';

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 1000 };
const banco: Account = { id: 'a2', name: 'Banco', type: 'debito', color: '#7B9CC7', initialBalance: 5000 };

const ingreso = (id: string, date: string, amount: number): Transaction => ({
  id, type: 'income', date, amount, description: '', accountId: 'a1', categoryId: 'sueldo', createdAt: 1,
});
const gasto = (id: string, date: string, amount: number): Transaction => ({
  id, type: 'expense', date, amount, description: '', accountId: 'a1', categoryId: 'comida', createdAt: 1,
});
const transferencia = (id: string, date: string, amount: number, taggedAsExpense = false): Transaction => ({
  id, type: 'transfer', date, amount, description: '', fromAccountId: 'a1', toAccountId: 'a2',
  taggedAsExpense, categoryId: 'comida', createdAt: 1,
});

describe('saldo inicial y final', () => {
  it('sin movimientos, la serie es plana en la suma de los saldos iniciales', () => {
    const s = computeBalanceSeries([efectivo, banco], [], '3m', HOY);

    expect(s.startBalance).toBe(6000);
    expect(s.endBalance).toBe(6000);
    expect(s.change).toBe(0);
    expect(s.points.every((p) => p.balance === 6000)).toBe(true);
  });

  it('un saldo inicial guardado como string o ausente se tolera', () => {
    const viejo = { id: 'a3', initialBalance: '250' };
    const sinSaldo = { id: 'a4' };

    const s = computeBalanceSeries([viejo, sinSaldo, efectivo], [], '1m', HOY);

    expect(s.endBalance).toBe(1250);
  });

  it('el ingreso suma y el gasto resta', () => {
    const s = computeBalanceSeries([efectivo], [ingreso('i', '2026-06-01', 500), gasto('g', '2026-06-02', 120)], '1m', HOY);

    expect(s.startBalance).toBe(1000);
    expect(s.endBalance).toBe(1380);
    expect(s.change).toBe(380);
  });

  it('una transferencia no mueve el total, ni siquiera marcada como gasto', () => {
    const s = computeBalanceSeries(
      [efectivo, banco],
      [transferencia('t1', '2026-06-01', 300), transferencia('t2', '2026-06-02', 200, true)],
      '1m',
      HOY,
    );

    expect(s.change).toBe(0);
    expect(s.endBalance).toBe(6000);
  });
});

describe('plazos', () => {
  const movs = [
    gasto('viejo', '2026-01-10', 400), // fuera de 1M y 3M
    ingreso('medio', '2026-04-20', 1000), // dentro de 3M, fuera de 1M
    gasto('reciente', '2026-06-05', 100), // dentro de todo
  ];

  it('lo anterior al plazo cuenta en el saldo inicial, no en el cambio', () => {
    const s = computeBalanceSeries([efectivo], movs, '1m', HOY);

    // 1000 − 400 + 1000 antes del 15 de mayo.
    expect(s.startBalance).toBe(1600);
    expect(s.endBalance).toBe(1500);
    expect(s.change).toBe(-100);
  });

  it('un plazo más largo incluye más cambio', () => {
    const s = computeBalanceSeries([efectivo], movs, '3m', HOY);

    expect(s.startBalance).toBe(600);
    expect(s.change).toBe(900);
  });

  it('"Todo" arranca en el primer movimiento y lo incluye en el cambio', () => {
    const s = computeBalanceSeries([efectivo], movs, 'all', HOY);

    expect(s.points[0]!.date).toBe('2026-01-10');
    expect(s.startBalance).toBe(1000);
    expect(s.endBalance).toBe(1500);
    expect(s.change).toBe(500);
  });

  it('"Todo" sin movimientos no truena', () => {
    const s = computeBalanceSeries([efectivo], [], 'all', HOY);

    expect(s.change).toBe(0);
    expect(s.points.at(-1)!.date).toBe(HOY);
  });

  it('un movimiento justo en el primer día del plazo entra al cambio', () => {
    const s = computeBalanceSeries([efectivo], [ingreso('i', '2026-05-15', 50)], '1m', HOY);

    expect(s.startBalance).toBe(1000);
    expect(s.change).toBe(50);
  });

  it('los movimientos futuros no cuentan', () => {
    const s = computeBalanceSeries([efectivo], [ingreso('f', '2026-07-01', 999)], '1m', HOY);

    expect(s.endBalance).toBe(1000);
  });
});

describe('puntos de la serie', () => {
  it('empieza en la línea base y termina hoy con el saldo final', () => {
    const s = computeBalanceSeries([efectivo], [gasto('g', '2026-06-10', 100)], '1m', HOY);

    expect(s.points[0]).toEqual({ date: '2026-05-15', balance: 1000 });
    expect(s.points.at(-1)).toEqual({ date: HOY, balance: 900 });
  });

  it('1M es diario; 3A se agrupa y no pasa de ~60 puntos', () => {
    const mes = computeBalanceSeries([efectivo], [], '1m', HOY);
    const tres = computeBalanceSeries([efectivo], [], '3y', HOY);

    expect(mes.points).toHaveLength(32);
    expect(tres.points.length).toBeLessThanOrEqual(62);
    expect(tres.points.length).toBeGreaterThan(30);
  });

  it('las fechas van en orden y el saldo de cada punto refleja el día', () => {
    const s = computeBalanceSeries([efectivo], [gasto('g', '2026-06-10', 100)], '1m', HOY);
    const fechas = s.points.map((p) => p.date);

    expect([...fechas].sort()).toEqual(fechas);
    expect(s.points.find((p) => p.date === '2026-06-09')!.balance).toBe(1000);
    expect(s.points.find((p) => p.date === '2026-06-10')!.balance).toBe(900);
  });
});

describe('porcentaje de cambio', () => {
  it('se calcula sobre el saldo inicial', () => {
    const s = computeBalanceSeries([efectivo], [ingreso('i', '2026-06-01', 500)], '1m', HOY);

    expect(s.changePct).toBeCloseTo(50);
  });

  it('es null cuando el saldo inicial es cero o negativo', () => {
    const cero = computeBalanceSeries([], [ingreso('i', '2026-06-01', 500)], '1m', HOY);
    const deuda = computeBalanceSeries([{ ...efectivo, initialBalance: -200 }], [ingreso('i', '2026-06-01', 500)], '1m', HOY);

    expect(cero.changePct).toBeNull();
    expect(deuda.changePct).toBeNull();
  });
});

describe('subtractMonthsIso', () => {
  it('resta meses de calendario', () => {
    expect(subtractMonthsIso('2026-06-15', 1)).toBe('2026-05-15');
    expect(subtractMonthsIso('2026-06-15', 12)).toBe('2025-06-15');
    expect(subtractMonthsIso('2026-02-10', 3)).toBe('2025-11-10');
  });

  it('cae al último día cuando el destino no tiene ese día', () => {
    expect(subtractMonthsIso('2026-03-31', 1)).toBe('2026-02-28');
    expect(subtractMonthsIso('2024-03-31', 1)).toBe('2024-02-29');
  });
});
