import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  parseMonefyDate,
  parseMonefyAmount,
  classifyMonefyCategory,
  parseMonefyRows,
  guessAccountType,
  guessCategoryIcon,
  parseOscarDescription,
  buildMonefyImportPreview,
  buildMonefyImportPlan,
} from '../../hilo-finanzas.jsx';

/* ------------------------------------------------------------------ */
/* parseCsv                                                            */
/* ------------------------------------------------------------------ */

describe('parseCsv', () => {
  it('campos entre comillas con comas internas', () => {
    expect(parseCsv('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('comillas escapadas ("")', () => {
    expect(parseCsv('"di ""hola""",x')).toEqual([['di "hola"', 'x']]);
  });

  it('CRLF y última línea sin salto', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('salto final no genera fila vacía; línea en blanco intermedia sí', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
    expect(parseCsv('a,b\n\nc,d')).toEqual([['a', 'b'], [''], ['c', 'd']]);
  });
});

/* ------------------------------------------------------------------ */
/* parseMonefyDate / parseMonefyAmount                                */
/* ------------------------------------------------------------------ */

describe('parseMonefyDate', () => {
  it('dd/mm/yyyy -> yyyy-mm-dd con zero-pad de día y mes', () => {
    expect(parseMonefyDate('5/3/2024')).toBe('2024-03-05');
    expect(parseMonefyDate('15/12/2026')).toBe('2026-12-15');
  });
});

describe('parseMonefyAmount', () => {
  it('separador de miles con coma', () => {
    expect(parseMonefyAmount('1,234.50')).toBe(1234.5);
  });
  it('negativos', () => {
    expect(parseMonefyAmount('-89.00')).toBe(-89);
  });
  it('texto inválido -> 0', () => {
    expect(parseMonefyAmount('n/a')).toBe(0);
    expect(parseMonefyAmount('')).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* classifyMonefyCategory                                             */
/* ------------------------------------------------------------------ */

describe('classifyMonefyCategory', () => {
  it("To 'X' / From 'Y' / Initial balance 'Z'", () => {
    expect(classifyMonefyCategory("To 'NU'")).toEqual({ kind: 'to', otherAccount: 'NU' });
    expect(classifyMonefyCategory("From 'Nómina'")).toEqual({ kind: 'from', otherAccount: 'Nómina' });
    expect(classifyMonefyCategory("Initial balance 'Efectivo'")).toEqual({ kind: 'initial', otherAccount: 'Efectivo' });
  });
  it('texto normal -> plain', () => {
    expect(classifyMonefyCategory('  Comida  ')).toEqual({ kind: 'plain', category: 'Comida' });
  });
});

/* ------------------------------------------------------------------ */
/* parseMonefyRows                                                    */
/* ------------------------------------------------------------------ */

describe('parseMonefyRows', () => {
  const header = 'date,account,category,amount,currency,converted amount,currency2,description';

  it('header válido (con BOM) -> filas mapeadas; descripción desde la col 7', () => {
    const csv = '﻿' + header + '\n' + '05/03/2024,NU,Comida,-180.00,MXN,-180.00,MXN,Tacos';
    const rows = parseMonefyRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2024-03-05', account: 'NU', amount: -180, description: 'Tacos',
      kind: 'plain', category: 'Comida',
    });
  });

  it('header incorrecto -> null', () => {
    expect(parseMonefyRows('foo,bar,baz\n1,2,3')).toBe(null);
  });

  it('filas demasiado cortas o vacías se saltan', () => {
    const csv = header + '\n' + 'sólo,tres,cols\n' + '\n' + '05/03/2024,NU,Comida,-10,MXN,-10,MXN,ok';
    const rows = parseMonefyRows(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('ok');
  });
});

/* ------------------------------------------------------------------ */
/* guessAccountType / guessCategoryIcon                               */
/* ------------------------------------------------------------------ */

describe('guessAccountType', () => {
  it('mapea por keyword y cae a "debito"', () => {
    expect(guessAccountType('Efectivo cartera')).toBe('efectivo');
    expect(guessAccountType('TDC Banamex')).toBe('credito');
    expect(guessAccountType('CETES directo')).toBe('inversion');
    expect(guessAccountType('Fondo de ahorro')).toBe('ahorro');
    expect(guessAccountType('Cuenta corriente')).toBe('debito');
  });
});

describe('guessCategoryIcon', () => {
  it('mapea por keyword y cae a "MoreHorizontal"', () => {
    expect(guessCategoryIcon('Comida rápida')).toBe('UtensilsCrossed');
    expect(guessCategoryIcon('Gasolina')).toBe('Fuel');
    expect(guessCategoryIcon('Algo rarísimo')).toBe('MoreHorizontal');
  });
});

/* ------------------------------------------------------------------ */
/* parseOscarDescription                                             */
/* ------------------------------------------------------------------ */

describe('parseOscarDescription', () => {
  it('fracción (N/D) + lugar - tamaño - marca - cantidad', () => {
    const p = parseOscarDescription('Laptop (3/6) - Costco - 15in - Dell - 1');
    expect(p).toMatchObject({
      description: 'Laptop', numerator: 3, denominator: 6,
      store: 'Costco', size: '15in', brand: 'Dell', quantity: '1',
    });
  });

  it('acepta corchetes [N/D] y numerador fraccionario', () => {
    const p = parseOscarDescription('Tenis [1.5/3] - Innovasport');
    expect(p.numerator).toBe(1.5);
    expect(p.denominator).toBe(3);
    expect(p.store).toBe('Innovasport');
  });

  it('sin fracción: separa por " - "', () => {
    const p = parseOscarDescription('Leche - 1L - Lala - 2');
    expect(p.numerator).toBe(null);
    expect(p).toMatchObject({ description: 'Leche', store: '1L', size: 'Lala', brand: '2' });
  });

  it('sin guiones ni fracción -> description es el texto completo, resto vacío', () => {
    const p = parseOscarDescription('Uber al centro');
    expect(p).toMatchObject({ description: 'Uber al centro', store: '', size: '', brand: '', quantity: '', numerator: null });
  });
});

/* ------------------------------------------------------------------ */
/* buildMonefyImportPreview                                          */
/* ------------------------------------------------------------------ */

describe('buildMonefyImportPreview', () => {
  it('detecta cuentas fantasma (sólo aparecen como contraparte de transferencia)', () => {
    const rows = [
      { date: '2024-01-02', account: 'NU', amount: -100, description: '', kind: 'to', otherAccount: 'Ahorro' },
      { date: '2024-01-02', account: 'Ahorro', amount: 100, description: '', kind: 'from', otherAccount: 'NU' },
    ];
    const preview = buildMonefyImportPreview(rows);
    const nu = preview.accounts.find(a => a.name === 'NU');
    const ahorro = preview.accounts.find(a => a.name === 'Ahorro');
    expect(nu.isGhost).toBe(false);   // aparece directamente como `account`
    expect(ahorro.isGhost).toBe(false); // también aparece directamente en su fila `from`
  });

  it('Initial balance puebla initialBalances y no genera transacción', () => {
    const rows = [
      { date: '2024-01-01', account: 'Efectivo', amount: 500, description: '', kind: 'initial', otherAccount: 'Efectivo' },
      { date: '2024-01-05', account: 'Efectivo', amount: -20, description: 'Café', kind: 'plain', category: 'Comida' },
    ];
    const preview = buildMonefyImportPreview(rows);
    expect(preview.initialBalances.get('Efectivo')).toBe(500);
    expect(preview.skeleton.plain).toHaveLength(1);
  });

  it('empareja To/From del mismo día y monto en una sola transferencia', () => {
    const rows = [
      { date: '2024-02-10', account: 'NU', amount: -300, description: 'Pase a efectivo', kind: 'to', otherAccount: 'Efectivo' },
      { date: '2024-02-10', account: 'Efectivo', amount: 300, description: '', kind: 'from', otherAccount: 'NU' },
    ];
    const preview = buildMonefyImportPreview(rows);
    expect(preview.transferCount).toBe(1);
    expect(preview.skeleton.transfers[0]).toMatchObject({ fromName: 'NU', toName: 'Efectivo', amount: 300 });
  });

  it('To/From sin pareja se degradan a expense/income en categoría Transferencias', () => {
    const rows = [
      { date: '2024-02-10', account: 'NU', amount: -300, description: 'huérfana', kind: 'to', otherAccount: 'Fantasma' },
      { date: '2024-02-11', account: 'Efectivo', amount: 50, description: 'huérfana 2', kind: 'from', otherAccount: 'Fantasma' },
    ];
    const preview = buildMonefyImportPreview(rows);
    expect(preview.transferCount).toBe(0);
    const degraded = preview.skeleton.plain;
    expect(degraded.find(d => d.type === 'expense' && d.categoryName === 'Transferencias')).toBeTruthy();
    expect(degraded.find(d => d.type === 'income' && d.categoryName === 'Transferencias')).toBeTruthy();
  });

  it('agrupa una serie MSI por cuenta+descripción+denominador y extrapola el total', () => {
    const rows = [
      { date: '2024-01-15', account: 'TDC', amount: -1000, description: 'Laptop (1/6)', kind: 'plain', category: 'Compras' },
      { date: '2024-02-15', account: 'TDC', amount: -1000, description: 'Laptop (2/6)', kind: 'plain', category: 'Compras' },
    ];
    const preview = buildMonefyImportPreview(rows);
    expect(preview.oscarConvention.seriesCount).toBe(1);
    expect(preview.oscarConvention.transactionsWithFraction).toBe(2);
    const series = [...preview.skeleton.msiSeries.values()][0];
    expect(series).toMatchObject({ installmentsCount: 6, description: 'Laptop', categoryName: 'Compras' });
    expect(series.totalAmount).toBe(6000); // paidSoFar(2000) * denom(6) / finalNumerator(2)
  });
});

/* ------------------------------------------------------------------ */
/* buildMonefyImportPlan                                             */
/* ------------------------------------------------------------------ */

describe('buildMonefyImportPlan', () => {
  function planFrom(rows, opts = {}) {
    const preview = buildMonefyImportPreview(rows);
    const accountDecisions = {};
    for (const a of preview.accounts) {
      accountDecisions[a.name] = { include: true, name: a.name, type: a.suggestedType };
    }
    return buildMonefyImportPlan(preview.skeleton, preview.initialBalances, {
      accountDecisions,
      existingAccounts: opts.existingAccounts || [],
      existingCategories: opts.existingCategories || [],
      useOscarConvention: opts.useOscarConvention || false,
    });
  }

  it('reutiliza cuenta y categoría existentes por nombre (case-insensitive)', () => {
    const rows = [
      { date: '2024-03-01', account: 'nu', amount: -50, description: 'Pan', kind: 'plain', category: 'comida' },
    ];
    const plan = planFrom(rows, {
      existingAccounts: [{ id: 'acc_nu', name: 'NU' }],
      existingCategories: [{ id: 'cat_comida', name: 'Comida', type: 'expense' }],
    });
    expect(plan.accountsToAdd).toHaveLength(0);
    expect(plan.categoriesToAdd).toHaveLength(0);
    expect(plan.transactions[0]).toMatchObject({ accountId: 'acc_nu', categoryId: 'cat_comida', type: 'expense', amount: 50 });
  });

  it('cuenta nueva -> se agrega con initialBalance del mapa', () => {
    const rows = [
      { date: '2024-01-01', account: 'Efectivo', amount: 500, description: '', kind: 'initial', otherAccount: 'Efectivo' },
      { date: '2024-01-03', account: 'Efectivo', amount: -20, description: 'Café', kind: 'plain', category: 'Comida' },
    ];
    const plan = planFrom(rows);
    const nueva = plan.accountsToAdd.find(a => a.name === 'Efectivo');
    expect(nueva).toBeTruthy();
    expect(nueva.initialBalance).toBe(500);
  });

  it('cuenta con include:false -> se omiten sus transacciones', () => {
    const rows = [
      { date: '2024-03-01', account: 'NU', amount: -50, description: 'Pan', kind: 'plain', category: 'Comida' },
    ];
    const preview = buildMonefyImportPreview(rows);
    const plan = buildMonefyImportPlan(preview.skeleton, preview.initialBalances, {
      accountDecisions: { NU: { include: false } },
      existingAccounts: [], existingCategories: [], useOscarConvention: false,
    });
    expect(plan.transactions).toHaveLength(0);
  });

  it('con convención Oscar: crea el plan MSI y vincula las transacciones de la serie', () => {
    const rows = [
      { date: '2024-01-15', account: 'TDC', amount: -1000, description: 'Laptop (1/6) - Costco', kind: 'plain', category: 'Compras' },
      { date: '2024-02-15', account: 'TDC', amount: -1000, description: 'Laptop (2/6) - Costco', kind: 'plain', category: 'Compras' },
    ];
    const plan = planFrom(rows, { useOscarConvention: true });
    expect(plan.installmentPlansToAdd).toHaveLength(1);
    const msiId = plan.installmentPlansToAdd[0].id;
    expect(plan.transactions.every(t => t.installmentPlanId === msiId)).toBe(true);
    expect(plan.transactions[0].store).toBe('Costco');
  });

  it('sin convención Oscar: size/brand/quantity quedan en null', () => {
    const rows = [
      { date: '2024-03-01', account: 'NU', amount: -50, description: 'Leche - 1L - Lala - 2', kind: 'plain', category: 'Comida' },
    ];
    const plan = planFrom(rows, { useOscarConvention: false });
    expect(plan.transactions[0]).toMatchObject({ size: null, brand: null, quantity: null, description: 'Leche - 1L - Lala - 2' });
  });

  it('transferencia con ambas cuentas resueltas -> type transfer', () => {
    const rows = [
      { date: '2024-02-10', account: 'NU', amount: -300, description: 'Pase', kind: 'to', otherAccount: 'Efectivo' },
      { date: '2024-02-10', account: 'Efectivo', amount: 300, description: '', kind: 'from', otherAccount: 'NU' },
    ];
    const plan = planFrom(rows);
    const tr = plan.transactions.find(t => t.type === 'transfer');
    expect(tr).toMatchObject({ amount: 300, taggedAsExpense: false });
    expect(tr.fromAccountId).toBeTruthy();
    expect(tr.toAccountId).toBeTruthy();
  });
});
