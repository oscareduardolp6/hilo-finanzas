/* Los totales del mes. La suite de regresión ya los cubre por el barrel; esto
   fija lo que ella no mira: el color de fallback y el argumento que lo elige. */

import { describe, it, expect } from 'vitest';
import { COLORS } from '../../../shared/design/tokens';
import type { Category, Transaction } from '../../../shared/domain/types';
import { computeCategoryTotals, computeTotalExpense, computeTotalIncome } from './totals';

const comida: Category = {
  id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#3F9C8B', type: 'expense',
};

const gasto = (amount: number, categoryId: string): Transaction => ({
  id: `g${amount}`, type: 'expense', date: '2026-03-02', amount, description: '',
  accountId: 'a1', categoryId,
});

const transferencia = (amount: number, taggedAsExpense: boolean, categoryId: string | null): Transaction => ({
  id: `t${amount}`, type: 'transfer', date: '2026-03-03', amount, description: '',
  fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense, categoryId,
});

const ingreso = (amount: number): Transaction => ({
  id: `i${amount}`, type: 'income', date: '2026-03-01', amount, description: '',
  accountId: 'a1', categoryId: 'sueldo',
});

describe('computeTotalExpense', () => {
  it('una transferencia marcada como gasto sí suma; sin marcar, no', () => {
    // El concepto central: pagar la tarjeta cuenta como gasto por categoría sin
    // volver a restar del saldo total.
    const txns = [gasto(100, 'comida'), transferencia(200, true, 'comida'), transferencia(999, false, null)];
    expect(computeTotalExpense(txns)).toBe(300);
  });
});

describe('computeTotalIncome', () => {
  it('solo los ingresos', () => {
    expect(computeTotalIncome([ingreso(1000), gasto(100, 'comida')])).toBe(1000);
  });
});

describe('computeCategoryTotals', () => {
  it('agrupa por categoría y ordena de mayor a menor', () => {
    const otra: Category = { ...comida, id: 'ropa', name: 'Ropa' };
    const totals = computeCategoryTotals(
      [gasto(50, 'comida'), gasto(30, 'comida'), gasto(200, 'ropa')],
      [comida, otra],
    );
    expect(totals.map(t => [t.name, t.total])).toEqual([['Ropa', 200], ['Comida', 80]]);
  });

  it('una categoría borrada cae a "Otros" con el color por defecto', () => {
    // El default reproduce el de antes del refactor, que es lo que hace que la
    // llamada de dos argumentos siga significando lo mismo.
    const [total] = computeCategoryTotals([gasto(10, 'fantasma')], []);
    expect(total).toMatchObject({ name: 'Otros', icon: 'MoreHorizontal', color: COLORS.textMuted });
  });

  it('el color de fallback se puede elegir', () => {
    const [total] = computeCategoryTotals([gasto(10, 'fantasma')], [], '#ff0000');
    expect(total!.color).toBe('#ff0000');
  });

  it('una transferencia marcada como gasto pero sin categoría no cuenta', () => {
    // No hay dónde sumarla; inventarle una categoría sería peor.
    expect(computeCategoryTotals([transferencia(10, true, null)], [comida])).toEqual([]);
  });
});
