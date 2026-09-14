/* Las tres ramas de `toTransaction`, que son las reglas de negocio más densas
   de Hilo. La suite de regresión las ejercita por el DOM; aquí se fijan campo a
   campo, que es donde se ven las asimetrías fáciles de romper al refactorizar. */

import { describe, it, expect } from 'vitest';
import type { TransactionFormDraft } from './form';
import { toTransaction } from './to-transaction';

const HOY = '2026-09-04';

const draft = (over: Partial<TransactionFormDraft> = {}): TransactionFormDraft => ({
  date: '2026-01-15',
  description: '  Tacos  ',
  amount: '250.50',
  ...over,
});

describe('gasto', () => {
  it('recorta la descripción y convierte el importe a número', () => {
    const t = toTransaction('expense', draft({ accountId: 'a1', categoryId: 'comida' }), HOY);

    expect(t).toMatchObject({ type: 'expense', description: 'Tacos', amount: 250.5, date: '2026-01-15' });
  });

  it('los campos de texto vacíos se guardan como null, no como cadena vacía', () => {
    const t = toTransaction('expense', draft({ store: '   ', size: '', brand: undefined }), HOY);

    expect(t).toMatchObject({ store: null, size: null, brand: null, quantity: null });
  });

  it('un gasto simple también puede abonar a un plan MSI', () => {
    const t = toTransaction('expense', draft({ installmentPlanId: 'msi_1' }), HOY);
    expect(t).toMatchObject({ installmentPlanId: 'msi_1' });
  });

  it('sin fecha usa el "hoy" que le pasa el caso de uso', () => {
    const t = toTransaction('expense', draft({ date: '' }), HOY);
    expect(t.date).toBe(HOY);
  });
});

describe('ingreso', () => {
  it('no arrastra tienda ni detalles de producto', () => {
    const t = toTransaction('income', draft({ accountId: 'a1', categoryId: 'sueldo', store: 'Walmart' }), HOY);

    expect(t).toEqual({
      type: 'income',
      date: '2026-01-15',
      description: 'Tacos',
      amount: 250.5,
      accountId: 'a1',
      categoryId: 'sueldo',
      benefitProgramId: null,
    });
  });

  it('conserva el programa de beneficios si se eligió uno', () => {
    const t = toTransaction('income', draft({ accountId: 'a1', categoryId: 'descuentos', benefitProgramId: 'benefit_1' }), HOY);
    expect(t).toMatchObject({ benefitProgramId: 'benefit_1' });
  });
});

describe('transferencia', () => {
  const transfer = (over: Partial<TransactionFormDraft> = {}) =>
    toTransaction('transfer', draft({ fromAccountId: 'a1', toAccountId: 'a2', ...over }), HOY);

  it('sin marcar como gasto fuerza a null categoría, tienda y detalles', () => {
    // El punto: si el usuario marcó, llenó y luego desmarcó, el dato viejo NO
    // puede quedarse colgando — contaría como gasto por categoría sin querer.
    const t = transfer({
      taggedAsExpense: false,
      categoryId: 'comida',
      store: 'Walmart',
      size: '1L',
      brand: 'Lala',
      quantity: '2',
      installmentPlanId: 'msi_1',
    });

    expect(t).toMatchObject({
      taggedAsExpense: false,
      categoryId: null,
      store: null,
      size: null,
      brand: null,
      quantity: null,
      installmentPlanId: null,
    });
  });

  it('marcada como gasto conserva categoría y detalles de producto', () => {
    const t = transfer({ taggedAsExpense: true, categoryId: 'belleza', size: '50ml', brand: 'Nivea' });

    expect(t).toMatchObject({ taggedAsExpense: true, categoryId: 'belleza', size: '50ml', brand: 'Nivea' });
  });

  it('solo cuenta como abono a MSI si además está marcada como gasto', () => {
    expect(transfer({ taggedAsExpense: true, installmentPlanId: 'msi_1' })).toMatchObject({
      installmentPlanId: 'msi_1',
    });
    expect(transfer({ taggedAsExpense: false, installmentPlanId: 'msi_1' })).toMatchObject({
      installmentPlanId: null,
    });
  });

  it('siendo MSI, la tienda se descarta: la tienda es la del plan', () => {
    const t = transfer({ taggedAsExpense: true, installmentPlanId: 'msi_1', store: 'Walmart' });
    expect(t).toMatchObject({ store: null });
  });

  it('marcada como gasto pero sin plan, sí guarda la tienda', () => {
    const t = transfer({ taggedAsExpense: true, store: 'Walmart' });
    expect(t).toMatchObject({ store: 'Walmart' });
  });
});
