import { describe, it, expect } from 'vitest';
import {
  computeBalances,
  computeTotalBalance,
  computePeriodTransactions,
  computeTotalIncome,
  computeTotalExpense,
  computeCategoryTotals,
  computeRecentTxns,
  computePlanProgress,
  computeKnownStores,
  computeHistorySuggestions,
  filterHistoryTransactions,
} from '../../hilo-finanzas.jsx';

/* ------------------------------------------------------------------ */
/* computePlanProgress — la más sensible                              */
/* ------------------------------------------------------------------ */

describe('computePlanProgress', () => {
  const plan = { id: 'p1', totalAmount: 900, installmentsCount: 6 };

  it('suma pagos de tipo transfer Y expense con installmentPlanId coincidente', () => {
    const txns = [
      { type: 'transfer', installmentPlanId: 'p1', amount: 150 },
      { type: 'expense', installmentPlanId: 'p1', amount: 75 },
      { type: 'income', installmentPlanId: 'p1', amount: 1000 }, // no cuenta
    ];
    const prog = computePlanProgress([plan], txns).p1;
    expect(prog.paid).toBe(225);
    expect(prog.per).toBe(150);
    expect(prog.installmentsPaid).toBeCloseTo(1.5, 5);
    expect(prog.remaining).toBe(675);
    expect(prog.pct).toBeCloseTo(0.25, 5);
    expect(prog.isPaidOff).toBe(false);
  });

  it('pago parcial: pct entre 0 y 1, remaining = total - paid', () => {
    const prog = computePlanProgress([plan], [{ type: 'expense', installmentPlanId: 'p1', amount: 300 }]).p1;
    expect(prog.pct).toBeGreaterThan(0);
    expect(prog.pct).toBeLessThan(1);
    expect(prog.remaining).toBe(600);
    expect(prog.isPaidOff).toBe(false);
  });

  it('pagos que cubren o exceden el total: clamp de pct a 1, remaining 0, isPaidOff', () => {
    const prog = computePlanProgress([plan], [
      { type: 'transfer', installmentPlanId: 'p1', amount: 500 },
      { type: 'transfer', installmentPlanId: 'p1', amount: 500 },
    ]).p1;
    expect(prog.paid).toBe(1000);
    expect(prog.pct).toBe(1);
    expect(prog.remaining).toBe(0);
    expect(prog.isPaidOff).toBe(true);
  });

  it('epsilon de 0.005: casi-pagado cuenta como pagado', () => {
    const near = computePlanProgress([plan], [{ type: 'expense', installmentPlanId: 'p1', amount: 900 - 0.004 }]).p1;
    expect(near.isPaidOff).toBe(true);
    const notYet = computePlanProgress([plan], [{ type: 'expense', installmentPlanId: 'p1', amount: 900 - 0.02 }]).p1;
    expect(notYet.isPaidOff).toBe(false);
  });

  it('installmentsCount fraccionario (1.5) — pagar en quincenas', () => {
    const p = { id: 'p1', totalAmount: 300, installmentsCount: 1.5 };
    const prog = computePlanProgress([p], [{ type: 'transfer', installmentPlanId: 'p1', amount: 100 }]).p1;
    expect(prog.per).toBe(200); // 300 / 1.5
    expect(prog.installmentsPaid).toBeCloseTo(0.5, 5);
  });

  it('totalAmount = 0: sin división por cero', () => {
    const p = { id: 'p1', totalAmount: 0, installmentsCount: 6 };
    const prog = computePlanProgress([p], [{ type: 'expense', installmentPlanId: 'p1', amount: 10 }]).p1;
    expect(prog.pct).toBe(0);
    expect(prog.per).toBe(0);
    expect(prog.installmentsPaid).toBe(0);
    expect(prog.isPaidOff).toBe(false);
  });

  it('plan sin pagos', () => {
    const prog = computePlanProgress([plan], []).p1;
    expect(prog).toMatchObject({ paid: 0, installmentsPaid: 0, remaining: 900, pct: 0, isPaidOff: false });
  });

  it('pagos de otro plan no cuentan', () => {
    const prog = computePlanProgress([plan], [{ type: 'expense', installmentPlanId: 'otro', amount: 900 }]).p1;
    expect(prog.paid).toBe(0);
  });

  it('devuelve un mapa indexado por id de plan', () => {
    const map = computePlanProgress([{ id: 'a', totalAmount: 10, installmentsCount: 1 }, { id: 'b', totalAmount: 20, installmentsCount: 1 }], []);
    expect(Object.keys(map).sort()).toEqual(['a', 'b']);
  });
});

/* ------------------------------------------------------------------ */
/* Totales de periodo                                                  */
/* ------------------------------------------------------------------ */

const periodTxns = [
  { type: 'expense', amount: 100, categoryId: 'comida' },
  { type: 'expense', amount: 50, categoryId: 'comida' },
  { type: 'income', amount: 1000, categoryId: 'salario' },
  { type: 'transfer', amount: 200, taggedAsExpense: true, categoryId: 'belleza' },
  { type: 'transfer', amount: 999, taggedAsExpense: false, categoryId: null },
];

describe('computeTotalExpense', () => {
  it('suma gastos + transferencias marcadas como gasto, excluye lo demás', () => {
    expect(computeTotalExpense(periodTxns)).toBe(350); // 100 + 50 + 200
  });
});

describe('computeTotalIncome', () => {
  it('sólo ingresos', () => {
    expect(computeTotalIncome(periodTxns)).toBe(1000);
  });
});

describe('computeCategoryTotals', () => {
  const categories = [
    { id: 'comida', name: 'Comida', color: '#111', icon: 'UtensilsCrossed' },
    { id: 'belleza', name: 'Belleza', color: '#222', icon: 'Sparkles' },
  ];

  it('agrupa gasto y transfer tagged por categoría, ordenado desc', () => {
    const totals = computeCategoryTotals(periodTxns, categories);
    expect(totals.map(t => [t.name, t.total])).toEqual([
      ['Belleza', 200],
      ['Comida', 150],
    ]);
  });

  it('categoría inexistente -> fallback "Otros"', () => {
    const totals = computeCategoryTotals([{ type: 'expense', amount: 10, categoryId: 'fantasma' }], categories);
    expect(totals[0]).toMatchObject({ name: 'Otros', icon: 'MoreHorizontal' });
  });

  it('transfer tagged sin categoryId se ignora', () => {
    const totals = computeCategoryTotals([{ type: 'transfer', taggedAsExpense: true, amount: 10, categoryId: null }], categories);
    expect(totals).toEqual([]);
  });
});

describe('computeBalances / computeTotalBalance', () => {
  const accounts = [
    { id: 'a', initialBalance: 1000 },
    { id: 'b', initialBalance: 0 },
  ];

  it('mapa por cuenta y suma total', () => {
    const txns = [
      { type: 'expense', accountId: 'a', amount: 100 },
      { type: 'income', accountId: 'b', amount: 500 },
    ];
    const bal = computeBalances(accounts, txns);
    expect(bal).toEqual({ a: 900, b: 500 });
    expect(computeTotalBalance(bal)).toBe(1400);
  });

  it('transferencia (plana o marcada como gasto) no cambia el saldo total', () => {
    const plain = [{ type: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: 300 }];
    expect(computeTotalBalance(computeBalances(accounts, plain))).toBe(1000);

    const tagged = [{ type: 'transfer', fromAccountId: 'a', toAccountId: 'b', amount: 300, taggedAsExpense: true, categoryId: 'x' }];
    expect(computeTotalBalance(computeBalances(accounts, tagged))).toBe(1000);
  });
});

describe('computePeriodTransactions', () => {
  const txns = [
    { id: '1', date: '2026-09-01' },
    { id: '2', date: '2026-09-30' },
    { id: '3', date: '2026-10-01' },
    { id: '4' }, // sin fecha
  ];
  it('match por prefijo YYYY-MM', () => {
    expect(computePeriodTransactions(txns, '2026-09').map(t => t.id)).toEqual(['1', '2']);
  });
  it('registros sin fecha se descartan', () => {
    expect(computePeriodTransactions(txns, '2026-10').map(t => t.id)).toEqual(['3']);
  });
});

describe('computeRecentTxns', () => {
  it('top N ordenado por fecha desc y createdAt desc', () => {
    const txns = [
      { id: 'a', date: '2026-09-01', createdAt: 1 },
      { id: 'b', date: '2026-09-03', createdAt: 1 },
      { id: 'c', date: '2026-09-03', createdAt: 9 },
      { id: 'd', date: '2026-08-15', createdAt: 1 },
    ];
    expect(computeRecentTxns(txns, 2).map(t => t.id)).toEqual(['c', 'b']);
  });
  it('no muta la entrada', () => {
    const txns = [{ id: 'a', date: '2026-09-01' }, { id: 'b', date: '2026-09-02' }];
    const copy = [...txns];
    computeRecentTxns(txns, 5);
    expect(txns).toEqual(copy);
  });
});

describe('computeKnownStores', () => {
  it('dedupe de tiendas de transacciones + planes, ordenado, sin vacíos', () => {
    const txns = [{ store: 'Walmart' }, { store: 'HEB' }, { store: 'Walmart' }, { store: '' }, {}];
    const plans = [{ store: 'Costco' }, { store: 'HEB' }];
    expect(computeKnownStores(txns, plans)).toEqual(['Costco', 'HEB', 'Walmart']);
  });
});

describe('computeHistorySuggestions', () => {
  it('incluye tiendas Y descripciones de transacciones y planes, dedupe y ordenado', () => {
    const txns = [
      { store: 'Walmart', description: 'Despensa' },
      { description: 'Uber' },
      { store: 'Walmart' },
    ];
    const plans = [{ description: 'Laptop', store: 'Costco' }];
    expect(computeHistorySuggestions(txns, plans)).toEqual(['Costco', 'Despensa', 'Laptop', 'Uber', 'Walmart']);
  });
});

/* ------------------------------------------------------------------ */
/* filterHistoryTransactions                                          */
/* ------------------------------------------------------------------ */

describe('filterHistoryTransactions', () => {
  const monthCursor = new Date(2026, 8, 1); // septiembre 2026
  const installmentPlans = [{ id: 'plan1', description: 'Audífonos', store: 'Sony Store' }];
  const txns = [
    { id: 'sep-exp', type: 'expense', date: '2026-09-10', categoryId: 'comida', store: 'Walmart', description: 'Tacos' },
    { id: 'sep-inc', type: 'income', date: '2026-09-11', categoryId: 'salario', description: 'Nómina' },
    { id: 'sep-tr', type: 'transfer', date: '2026-09-12', taggedAsExpense: true, categoryId: 'comida', description: 'Pago TDC' },
    { id: 'sep-msi', type: 'expense', date: '2026-09-13', categoryId: 'compras', installmentPlanId: 'plan1', description: 'Abono' },
    { id: 'ago-exp', type: 'expense', date: '2026-08-20', categoryId: 'comida', store: 'HEB', description: 'Despensa' },
  ];
  const base = {
    transactions: txns, installmentPlans, monthCursor,
    showAllTime: false, searching: false, q: '',
    filterType: 'all', filterCategory: 'all', filterStore: 'all',
  };

  it('sin filtros y sin showAllTime -> sólo el mes del cursor', () => {
    const out = filterHistoryTransactions(base).map(t => t.id);
    expect(out).toEqual(['sep-exp', 'sep-inc', 'sep-tr', 'sep-msi']);
  });

  it('showAllTime -> incluye otros meses', () => {
    const out = filterHistoryTransactions({ ...base, showAllTime: true }).map(t => t.id);
    expect(out).toContain('ago-exp');
  });

  it("filterType 'msi' -> sólo con installmentPlanId", () => {
    expect(filterHistoryTransactions({ ...base, filterType: 'msi' }).map(t => t.id)).toEqual(['sep-msi']);
  });

  it("filterType 'transfer' -> sólo transferencias", () => {
    expect(filterHistoryTransactions({ ...base, filterType: 'transfer' }).map(t => t.id)).toEqual(['sep-tr']);
  });

  it('filterCategory abarca gasto, ingreso y transfer tagged con esa categoría', () => {
    const out = filterHistoryTransactions({ ...base, filterCategory: 'comida' }).map(t => t.id);
    expect(out).toEqual(['sep-exp', 'sep-tr']);
  });

  it('filterStore -> match exacto', () => {
    expect(filterHistoryTransactions({ ...base, showAllTime: true, filterStore: 'HEB' }).map(t => t.id)).toEqual(['ago-exp']);
  });

  it('búsqueda: ignora el mes y matchea descripción / tienda / plan MSI vinculado, sin acentos ni mayúsculas', () => {
    // "audifonos" (sin acento) matchea el plan MSI vinculado a sep-msi
    const out = filterHistoryTransactions({ ...base, searching: true, q: 'audifonos' }).map(t => t.id);
    expect(out).toEqual(['sep-msi']);

    // matchea contra tienda aunque sea de otro mes (búsqueda = todo el tiempo)
    const byStore = filterHistoryTransactions({ ...base, searching: true, q: 'heb' }).map(t => t.id);
    expect(byStore).toEqual(['ago-exp']);
  });

  it('los filtros se componen (tipo + categoría + búsqueda)', () => {
    const out = filterHistoryTransactions({
      ...base, searching: true, q: 'pago', filterType: 'transfer', filterCategory: 'comida',
    }).map(t => t.id);
    expect(out).toEqual(['sep-tr']);
  });
});
