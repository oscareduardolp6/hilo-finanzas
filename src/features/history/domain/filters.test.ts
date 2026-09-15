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
  it('junta tiendas y descripciones de movimientos y planes, sin repetir, ordenadas por más reciente', () => {
    const txns = [
      gasto('t1', '2026-01-01', { description: 'Tacos', store: 'Walmart' }),
      gasto('t2', '2026-01-02', { description: 'Tacos', store: 'Oxxo' }),
    ];

    // plan.startDate es '2026-01-01', así que su tienda/descripción quedan
    // empatadas con t1 y antes que t2 (2026-01-02, la más reciente).
    expect(computeHistorySuggestions(txns, [plan])).toEqual([
      'Tacos', 'Oxxo', 'Walmart', 'Audífonos inalámbricos',
    ]);
  });

  it('sin datos, ninguna sugerencia', () => {
    expect(computeHistorySuggestions([], [])).toEqual([]);
  });

  it('se queda con la aparición más reciente de un valor repetido en distintos campos/fechas', () => {
    const txns = [
      gasto('t1', '2026-01-01', { store: 'HEB', description: '' }),
      gasto('t2', '2026-01-10', { description: 'HEB', store: null }),
    ];
    expect(computeHistorySuggestions(txns, [])).toEqual(['HEB']);
  });

  it('recorta al límite (default 10), priorizando lo más reciente', () => {
    const txns = Array.from({ length: 15 }, (_, i) =>
      gasto(`t${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, { store: `Tienda ${i}`, description: '' }),
    );
    const result = computeHistorySuggestions(txns, []);
    expect(result).toHaveLength(10);
    expect(result).toEqual([
      'Tienda 14', 'Tienda 13', 'Tienda 12', 'Tienda 11', 'Tienda 10',
      'Tienda 9', 'Tienda 8', 'Tienda 7', 'Tienda 6', 'Tienda 5',
    ]);
  });

  it('respeta un límite explícito distinto al default', () => {
    const txns = [
      gasto('a', '2026-09-01', { store: 'A', description: '' }),
      gasto('b', '2026-09-02', { store: 'B', description: '' }),
      gasto('c', '2026-09-03', { store: 'C', description: '' }),
    ];
    expect(computeHistorySuggestions(txns, [], 2)).toEqual(['C', 'B']);
  });
});
