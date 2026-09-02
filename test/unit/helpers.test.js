import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  uid,
  todayIso,
  monthKey,
  monthLabel,
  formatDateLabel,
  formatMoney,
  normalizeForSearch,
  accountNameMatches,
  highlightMatch,
  computeAccountBalance,
  groupByDate,
  initialFormState,
  recordStamp,
} from '../../hilo-finanzas.jsx';

/* ------------------------------------------------------------------ */
/* formatMoney                                                         */
/* ------------------------------------------------------------------ */

describe('formatMoney', () => {
  it('formatea con separador de miles y 2 decimales', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(1000000)).toBe('$1,000,000.00');
  });

  it('antepone el signo menos al símbolo de peso', () => {
    expect(formatMoney(-180)).toBe('-$180.00');
  });

  it('cero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('null / undefined / NaN / no numérico -> $0.00', () => {
    expect(formatMoney(null)).toBe('$0.00');
    expect(formatMoney(undefined)).toBe('$0.00');
    expect(formatMoney(NaN)).toBe('$0.00');
    expect(formatMoney('no soy número')).toBe('$0.00');
  });

  it('acepta strings numéricas', () => {
    expect(formatMoney('2500.4')).toBe('$2,500.40');
  });
});

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

describe('helpers de fecha', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mediodía para evitar rarezas de zona horaria en los límites del día.
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0)); // 15 de septiembre de 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayIso -> YYYY-MM-DD con zero-pad', () => {
    expect(todayIso()).toBe('2026-09-15');
    vi.setSystemTime(new Date(2026, 0, 3, 12, 0, 0));
    expect(todayIso()).toBe('2026-01-03');
  });

  it('monthKey -> YYYY-MM con zero-pad de mes', () => {
    expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
  });

  it('monthLabel -> mes y año, primera letra en mayúscula', () => {
    const label = monthLabel(new Date(2026, 8, 1));
    expect(label[0]).toBe(label[0].toUpperCase());
    expect(label).toMatch(/2026/);
    // es-MX: "Septiembre de 2026"
    expect(label.toLowerCase()).toContain('septiembre');
  });

  it('formatDateLabel: hoy y ayer', () => {
    expect(formatDateLabel('2026-09-15')).toBe('Hoy');
    expect(formatDateLabel('2026-09-14')).toBe('Ayer');
  });

  it('formatDateLabel: mismo año -> sin año; otro año -> con año', () => {
    const sameYear = formatDateLabel('2026-03-08');
    expect(sameYear).not.toMatch(/2026/);
    expect(sameYear[0]).toBe(sameYear[0].toUpperCase());

    const otherYear = formatDateLabel('2024-03-08');
    expect(otherYear).toMatch(/2024/);
  });

  it('formatDateLabel parsea YYYY-MM-DD sin corrimiento de zona horaria', () => {
    // Con `new Date("2026-09-15")` (UTC) esto se iría al día anterior en zonas
    // al oeste de UTC. La implementación usa componentes locales, así que es "Hoy".
    expect(formatDateLabel('2026-09-15')).toBe('Hoy');
  });
});

/* ------------------------------------------------------------------ */
/* Búsqueda de texto                                                   */
/* ------------------------------------------------------------------ */

describe('normalizeForSearch', () => {
  it('pasa a minúsculas y quita acentos', () => {
    expect(normalizeForSearch('Nómina')).toBe('nomina');
    expect(normalizeForSearch('ÁÉÍÓÚ')).toBe('aeiou');
  });

  it('null / undefined -> cadena vacía', () => {
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch(undefined)).toBe('');
  });
});

describe('accountNameMatches', () => {
  it('query vacío -> siempre true', () => {
    expect(accountNameMatches('NU', '')).toBe(true);
    expect(accountNameMatches('NU', '   ')).toBe(true);
  });

  it('match insensible a acentos y mayúsculas', () => {
    expect(accountNameMatches('Nómina', 'nomina')).toBe(true);
    expect(accountNameMatches('Mercado Pago', 'PAGO')).toBe(true);
  });

  it('sin coincidencia -> false', () => {
    expect(accountNameMatches('Efectivo', 'nu')).toBe(false);
  });
});

describe('highlightMatch', () => {
  it('query vacío -> string tal cual', () => {
    expect(highlightMatch('Tacos', '')).toBe('Tacos');
    expect(highlightMatch('Tacos', '   ')).toBe('Tacos');
  });

  it('sin coincidencia -> string plano', () => {
    expect(highlightMatch('Tacos', 'uber')).toBe('Tacos');
  });

  it('coincidencia -> [antes, <mark>, después] insensible a mayúsculas', () => {
    const out = highlightMatch('Cena en Tacos El Güero', 'tacos');
    expect(Array.isArray(out)).toBe(true);
    expect(out[0]).toBe('Cena en ');
    expect(out[1].type).toBe('mark');
    expect(out[1].props.children).toBe('Tacos');
    expect(out[2]).toBe(' El Güero');
  });

  it('es sensible a acentos (no resalta si sólo coincide sin acento)', () => {
    expect(highlightMatch('Nómina', 'nomina')).toBe('Nómina');
  });

  it('valores no-string se convierten', () => {
    expect(highlightMatch(null, 'x')).toBe('');
    expect(highlightMatch(42, 'x')).toBe('42');
  });
});

/* ------------------------------------------------------------------ */
/* computeAccountBalance                                               */
/* ------------------------------------------------------------------ */

describe('computeAccountBalance', () => {
  const acc = { id: 'a1', initialBalance: 100 };

  it('suma ingresos y resta gastos de la cuenta', () => {
    const txns = [
      { type: 'income', accountId: 'a1', amount: 50 },
      { type: 'expense', accountId: 'a1', amount: 30 },
    ];
    expect(computeAccountBalance(acc, txns)).toBe(120);
  });

  it('transferencia: resta en fromAccountId, suma en toAccountId', () => {
    const txns = [{ type: 'transfer', fromAccountId: 'a1', toAccountId: 'a2', amount: 40 }];
    expect(computeAccountBalance({ id: 'a1', initialBalance: 100 }, txns)).toBe(60);
    expect(computeAccountBalance({ id: 'a2', initialBalance: 0 }, txns)).toBe(40);
  });

  it('ignora movimientos de otras cuentas', () => {
    const txns = [
      { type: 'income', accountId: 'otra', amount: 999 },
      { type: 'expense', accountId: 'otra', amount: 999 },
    ];
    expect(computeAccountBalance(acc, txns)).toBe(100);
  });

  it('initialBalance ausente -> 0', () => {
    expect(computeAccountBalance({ id: 'a1' }, [])).toBe(0);
  });

  it('initialBalance como string se coacciona a número', () => {
    expect(computeAccountBalance({ id: 'a1', initialBalance: '250' }, [])).toBe(250);
  });

  it('transferencia dentro de la misma cuenta (from === to) se neutraliza', () => {
    const txns = [{ type: 'transfer', fromAccountId: 'a1', toAccountId: 'a1', amount: 40 }];
    expect(computeAccountBalance(acc, txns)).toBe(100);
  });
});

/* ------------------------------------------------------------------ */
/* groupByDate                                                         */
/* ------------------------------------------------------------------ */

describe('groupByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('ordena por fecha desc y luego createdAt desc, agrupando por etiqueta', () => {
    const list = [
      { id: 'a', date: '2026-09-14', createdAt: 1 },
      { id: 'b', date: '2026-09-15', createdAt: 1 },
      { id: 'c', date: '2026-09-15', createdAt: 5 },
    ];
    const groups = groupByDate(list);
    expect(groups.map(([label]) => label)).toEqual(['Hoy', 'Ayer']);
    expect(groups[0][1].map(t => t.id)).toEqual(['c', 'b']); // createdAt desc dentro del día
    expect(groups[1][1].map(t => t.id)).toEqual(['a']);
  });

  it('createdAt ausente se trata como 0', () => {
    const list = [
      { id: 'a', date: '2026-09-15' },
      { id: 'b', date: '2026-09-15', createdAt: 10 },
    ];
    const [[, sameDay]] = groupByDate(list);
    expect(sameDay.map(t => t.id)).toEqual(['b', 'a']);
  });

  it('no muta la lista de entrada', () => {
    const list = [
      { id: 'a', date: '2026-09-14', createdAt: 1 },
      { id: 'b', date: '2026-09-15', createdAt: 1 },
    ];
    const copy = [...list];
    groupByDate(list);
    expect(list).toEqual(copy);
  });
});

/* ------------------------------------------------------------------ */
/* initialFormState                                                    */
/* ------------------------------------------------------------------ */

describe('initialFormState', () => {
  const accounts = [{ id: 'acc1' }, { id: 'acc2' }];
  const categories = [
    { id: 'gasto1', type: 'expense' },
    { id: 'ingreso1', type: 'income' },
  ];

  it('expense: primera cuenta y primera categoría de gasto', () => {
    const f = initialFormState('expense', accounts, categories);
    expect(f).toMatchObject({ accountId: 'acc1', categoryId: 'gasto1', installmentPlanId: null, amount: '' });
  });

  it('income: primera cuenta y primera categoría de ingreso', () => {
    const f = initialFormState('income', accounts, categories);
    expect(f).toMatchObject({ accountId: 'acc1', categoryId: 'ingreso1' });
  });

  it('transfer: from = cuenta[0], to = cuenta[1], taggedAsExpense false', () => {
    const f = initialFormState('transfer', accounts, categories);
    expect(f).toMatchObject({ fromAccountId: 'acc1', toAccountId: 'acc2', taggedAsExpense: false, categoryId: '' });
  });

  it('transfer con una sola cuenta: to cae en esa misma cuenta', () => {
    const f = initialFormState('transfer', [{ id: 'solo' }], categories);
    expect(f).toMatchObject({ fromAccountId: 'solo', toAccountId: 'solo' });
  });

  it('arrays vacíos -> ids en cadena vacía', () => {
    const f = initialFormState('expense', [], []);
    expect(f.accountId).toBe('');
    expect(f.categoryId).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/* recordStamp & uid                                                   */
/* ------------------------------------------------------------------ */

describe('recordStamp', () => {
  it('usa updatedAt si existe', () => {
    expect(recordStamp({ updatedAt: 20, createdAt: 10 })).toBe(20);
  });
  it('cae a createdAt si no hay updatedAt', () => {
    expect(recordStamp({ createdAt: 10 })).toBe(10);
  });
  it('sin ninguno -> 0', () => {
    expect(recordStamp({})).toBe(0);
  });
  it('updatedAt = 0 es válido (no cae a createdAt)', () => {
    expect(recordStamp({ updatedAt: 0, createdAt: 10 })).toBe(0);
  });
});

describe('uid', () => {
  it('respeta el prefijo y genera valores distintos', () => {
    const a = uid('txn');
    const b = uid('txn');
    expect(a.startsWith('txn_')).toBe(true);
    expect(a).not.toBe(b);
  });
  it('sin prefijo usa "id"', () => {
    expect(uid().startsWith('id_')).toBe(true);
  });
});
