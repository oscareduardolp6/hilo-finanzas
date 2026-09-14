/* Planear y aplicar, con reloj e ids fijos. La ganancia de inyectarlos es
   justo esto: `buildMonefyImportPlan` llamaba a `Date.now()` y a `uid()` por
   dentro, así que su salida no se podía comparar entera. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { Account, Category, DataState } from '../../../shared/domain/types';
import { parseMonefyRows } from '../domain/csv';
import { buildMonefyImportPreview } from '../domain/preview';
import type { MonefyPreview } from '../domain/preview';
import type { AccountDecisions } from '../domain/plan';
import { importMonefy, planMonefyImport } from './import-monefy';

const AHORA = 1_700_000_000_000;

let n = 0;
const deps = createDeps({ clock: () => AHORA, idGenerator: (p) => `${p}_${++n}` });

const CSV = [
  'date,account,category,amount,currency,converted amount,currency,description',
  '01/03/2024,Efectivo,Comida,-180.00,MXN,-180.00,MXN,Tacos',
  '02/03/2024,Efectivo,Salario,5000.00,MXN,5000.00,MXN,Nómina',
].join('\n');

const preview = (): MonefyPreview => buildMonefyImportPreview(parseMonefyRows(CSV)!);

const todasIncluidas = (p: MonefyPreview): AccountDecisions => {
  const decisions: AccountDecisions = {};
  for (const acc of p.accounts) decisions[acc.name] = { include: true, type: acc.suggestedType, name: acc.name };
  return decisions;
};

const planFor = (p: MonefyPreview, existingAccounts: Account[] = [], existingCategories: Category[] = []) =>
  runRIO(planMonefyImport({
    preview: p,
    accountDecisions: todasIncluidas(p),
    useOscarConvention: false,
    existingAccounts,
    existingCategories,
  }), deps);

const vacio = (): DataState => ({
  accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [], benefitPrograms: [],
});

describe('planMonefyImport', () => {
  it('crea la cuenta y las categorías que faltan, con ids del generador inyectado', () => {
    n = 0;
    const plan = planFor(preview());

    expect(plan.accountsToAdd.map(a => a.id)).toEqual(['acc_1']);
    expect(plan.categoriesToAdd.map(c => c.name).sort()).toEqual(['Comida', 'Salario']);
    // Un gasto y un ingreso, cada uno con su categoría del tipo correcto.
    expect(plan.transactions.map(t => t.type)).toEqual(['expense', 'income']);
  });

  it('reutiliza una cuenta que ya existe en Hilo en vez de duplicarla', () => {
    n = 0;
    const yaEsta: Account = { id: 'mia', name: 'efectivo', type: 'efectivo', color: '#000', initialBalance: 0 };

    const plan = planFor(preview(), [yaEsta]);

    expect(plan.accountsToAdd).toEqual([]);
    expect(plan.transactions.every(t => t.type !== 'transfer' && t.accountId === 'mia')).toBe(true);
  });

  it('fecha los registros con el reloj inyectado, correlativos para conservar el orden', () => {
    n = 0;
    const plan = planFor(preview());

    expect(plan.transactions.map(t => t.createdAt)).toEqual([AHORA, AHORA + 1]);
  });

  it('no aplica nada por sí solo: solo describe lo que se crearía', () => {
    n = 0;
    const plan = planFor(preview());

    expect(plan.transactions).toHaveLength(2);
    // Ninguna de las dos colecciones de partida se tocó.
    expect(vacio().transactions).toEqual([]);
  });
});

describe('importMonefy', () => {
  it('agrega lo del plan a lo que ya había, sellado con la hora de ahora', () => {
    n = 0;
    const plan = planFor(preview());

    const next = runRIO(importMonefy(vacio(), plan), deps);

    expect(next.accounts).toHaveLength(1);
    expect(next.transactions).toHaveLength(2);
    expect(next.transactions.every(t => t.updatedAt === AHORA)).toBe(true);
    expect(next.toast).toBe('Se importaron 2 movimientos de Monefy');
  });

  it('sin cuentas ni categorías nuevas deja esas colecciones tal cual', () => {
    n = 0;
    const yaEsta: Account = { id: 'mia', name: 'Efectivo', type: 'efectivo', color: '#000', initialBalance: 0 };
    const cats: Category[] = [
      { id: 'c1', name: 'Comida', icon: 'UtensilsCrossed', color: '#111', type: 'expense' },
      { id: 'c2', name: 'Salario', icon: 'Wallet', color: '#222', type: 'income' },
    ];
    const current: DataState = { ...vacio(), accounts: [yaEsta], categories: cats };

    const next = runRIO(importMonefy(current, planFor(preview(), [yaEsta], cats)), deps);

    expect(next.accounts).toBe(current.accounts);
    expect(next.categories).toBe(current.categories);
    expect(next.installmentPlans).toBe(current.installmentPlans);
  });
});
