/* El filtro del historial. La suite de regresión ya cubre cada filtro por
   separado; esto fija lo que ella no mira: cómo se COMPONEN, y la regla de que
   buscar ignora el mes. */

import { describe, it, expect } from 'vitest';
import type { InstallmentPlan, Transaction } from '../../../shared/domain/types';
import { computeHistorySuggestions, filterHistoryTransactions } from './filters';

const enero = new Date(2026, 0, 1);
const febrero = new Date(2026, 1, 1);

const gasto = (id: string, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, type: 'expense', date, amount: 100, description: id,
  accountId: 'a1', categoryId: 'comida', ...extra,
} as Transaction);

const plan: InstallmentPlan = {
  id: 'msi_1', description: 'Audífonos inalámbricos', store: 'Walmart',
  totalAmount: 900, installmentsCount: 6, categoryId: 'compras', startDate: '2026-01-01',
};

const base = {
  installmentPlans: [plan],
  showAllTime: false,
  searching: false,
  q: '',
  monthCursor: enero,
  filterType: 'all',
  filterCategory: 'all',
  filterStore: 'all',
};

const ids = (list: Transaction[]) => list.map(t => t.id);

describe('mes vs. todo el tiempo', () => {
  const txns = [gasto('ene', '2026-01-15'), gasto('feb', '2026-02-10')];

  it('por defecto solo el mes del cursor', () => {
    expect(ids(filterHistoryTransactions({ ...base, transactions: txns }))).toEqual(['ene']);
    expect(ids(filterHistoryTransactions({ ...base, transactions: txns, monthCursor: febrero }))).toEqual(['feb']);
  });

  it('showAllTime ignora el cursor', () => {
    expect(ids(filterHistoryTransactions({ ...base, transactions: txns, showAllTime: true }))).toEqual(['ene', 'feb']);
  });
});

describe('los filtros se componen', () => {
  const txns = [
    gasto('comida-walmart', '2026-01-05', { store: 'Walmart' }),
    gasto('ropa-walmart', '2026-01-06', { store: 'Walmart', categoryId: 'ropa' }),
    gasto('comida-oxxo', '2026-01-07', { store: 'Oxxo' }),
  ];

  it('categoría y tienda a la vez', () => {
    const out = filterHistoryTransactions({
      ...base, transactions: txns, filterCategory: 'comida', filterStore: 'Walmart',
    });
    expect(ids(out)).toEqual(['comida-walmart']);
  });
});

describe('filtro por tipo', () => {
  const abono = {
    id: 'abono', type: 'transfer', date: '2026-01-08', amount: 150, description: 'Pago',
    fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: true,
    categoryId: 'compras', installmentPlanId: 'msi_1',
  } as Transaction;
  const txns = [gasto('g1', '2026-01-05'), abono];

  it('"msi" NO es un tipo de movimiento: es tener plan vinculado', () => {
    // Por eso un `transfer` con plan sale con filtro 'msi' y también con 'transfer'.
    expect(ids(filterHistoryTransactions({ ...base, transactions: txns, filterType: 'msi' }))).toEqual(['abono']);
    expect(ids(filterHistoryTransactions({ ...base, transactions: txns, filterType: 'transfer' }))).toEqual(['abono']);
  });

  it('un gasto suelto no cuenta como MSI', () => {
    expect(ids(filterHistoryTransactions({ ...base, transactions: [gasto('g1', '2026-01-05')], filterType: 'msi' }))).toEqual([]);
  });
});

describe('filtro por categoría', () => {
  const sinMarcar = {
    id: 'transfer-limpia', type: 'transfer', date: '2026-01-09', amount: 50, description: '',
    fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: false, categoryId: 'comida',
  } as Transaction;

  it('una transferencia sin marcar como gasto no entra por su categoría', () => {
    // Si entrara, el historial filtrado por "Comida" mostraría dinero que nunca
    // se gastó en comida.
    const out = filterHistoryTransactions({ ...base, transactions: [sinMarcar], filterCategory: 'comida' });
    expect(out).toEqual([]);
  });

  it('marcada como gasto, sí', () => {
    const marcada = { ...sinMarcar, id: 'transfer-gasto', taggedAsExpense: true } as Transaction;
    const out = filterHistoryTransactions({ ...base, transactions: [marcada], filterCategory: 'comida' });
    expect(ids(out)).toEqual(['transfer-gasto']);
  });
});

describe('búsqueda', () => {
  const txns = [
    gasto('viejo', '2020-05-01', { description: 'Café con Nómina' }),
    gasto('abono', '2026-01-08', { description: 'Pago', installmentPlanId: 'msi_1' }),
  ];

  it('busca en todo el tiempo, ignorando el cursor de mes', () => {
    // Es la regla que hace que el buscador sea útil: si respetara el mes, el
    // resultado dependería de dónde estabas parado al empezar a escribir.
    const out = filterHistoryTransactions({ ...base, transactions: txns, searching: true, q: 'cafe' });
    expect(ids(out)).toEqual(['viejo']);
  });

  it('encuentra un abono por el nombre del plan, no solo por el suyo', () => {
    const out = filterHistoryTransactions({ ...base, transactions: txns, searching: true, q: 'audifonos' });
    expect(ids(out)).toEqual(['abono']);
  });

  it('también por la tienda del plan', () => {
    const out = filterHistoryTransactions({ ...base, transactions: txns, searching: true, q: 'walmart' });
    expect(ids(out)).toEqual(['abono']);
  });

  it('se compone con los demás filtros', () => {
    const out = filterHistoryTransactions({
      ...base, transactions: txns, searching: true, q: 'a', filterType: 'msi',
    });
    expect(ids(out)).toEqual(['abono']);
  });
});

describe('computeHistorySuggestions', () => {
  it('junta tiendas y descripciones de movimientos y planes, sin repetir y ordenadas', () => {
    const txns = [
      gasto('t1', '2026-01-01', { description: 'Tacos', store: 'Walmart' }),
      gasto('t2', '2026-01-02', { description: 'Tacos', store: 'Oxxo' }),
    ];

    expect(computeHistorySuggestions(txns, [plan])).toEqual([
      'Audífonos inalámbricos', 'Oxxo', 'Tacos', 'Walmart',
    ]);
  });

  it('sin datos, ninguna sugerencia', () => {
    expect(computeHistorySuggestions([], [])).toEqual([]);
  });
});
