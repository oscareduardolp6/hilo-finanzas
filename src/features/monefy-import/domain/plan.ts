/* Del esqueleto + las decisiones del usuario, los registros que se van a
   agregar. Es el paso que resuelve identidad: qué cuenta y qué categoría es
   cada nombre, creando las que falten y reusando las que ya existen en Hilo.

   Devuelve un PLAN, no lo aplica: quien lo aplica es el caso de uso, que además
   les pone `updatedAt`. Así la hoja puede enseñar el resumen ("N movimientos, M
   cuentas nuevas") antes de que nada entre al store. */

import { CATEGORY_PALETTE } from '../../../shared/design/tokens';
import { uid } from '../../../shared/domain/ids';
import type { IdGenerator } from '../../../shared/domain/ports';
import type {
  Account, AccountTypeId, Category, InstallmentPlan, Transaction,
} from '../../../shared/domain/types';
import { MONEFY_TRANSFER_CATEGORY } from './csv';
import { guessCategoryIcon } from './guess';
import type { MonefySkeleton } from './preview';

/** Lo que el usuario decidió para cada cuenta detectada en el CSV. */
export type AccountDecision = {
  include: boolean;
  type: AccountTypeId;
  /** Puede haberla renombrado en la hoja de revisión. */
  name: string;
};

export type AccountDecisions = Record<string, AccountDecision | undefined>;

export type MonefyImportPlan = {
  accountsToAdd: Account[];
  categoriesToAdd: Category[];
  installmentPlansToAdd: InstallmentPlan[];
  transactions: Transaction[];
};

export type BuildPlanOptions = {
  accountDecisions: AccountDecisions;
  existingAccounts: Account[];
  existingCategories: Category[];
  useOscarConvention: boolean;
  /* Los dos de abajo son inyectables para volver la función determinista; sin
     ellos se comporta igual que antes del refactor, que es lo que necesita la
     llamada de `test/unit/monefy.test.js`. */
  now?: number;
  newId?: IdGenerator;
};

export function buildMonefyImportPlan(
  skeleton: MonefySkeleton,
  initialBalances: Map<string, number>,
  { accountDecisions, existingAccounts, existingCategories, useOscarConvention, now, newId }: BuildPlanOptions,
): MonefyImportPlan {
  const makeId: IdGenerator = newId || uid;
  const accountsToAdd: Account[] = [];
  const categoriesToAdd: Category[] = [];
  const newAccountIds = new Map<string, string>();
  const newCategoryIds = new Map<string, string>();
  // Los colores siguen a los que ya hay, para que un import no repita el de la
  // cuenta de al lado. La paleta es un token de diseño dentro del dominio: la
  // misma fuga a medio cerrar que `computeCategoryTotals` (ver §9 del plan).
  let colorIndex = existingAccounts.length + existingCategories.length;
  function nextColor(): string {
    return CATEGORY_PALETTE[colorIndex++ % CATEGORY_PALETTE.length]!;
  }

  function accountIdFor(name: string): string | null {
    const decision = accountDecisions[name];
    if (!decision || decision.include === false) return null;
    if (newAccountIds.has(name)) return newAccountIds.get(name)!;
    const finalName = (decision.name || name).trim();
    const existing = existingAccounts.find(a => a.name.trim().toLowerCase() === finalName.toLowerCase());
    if (existing) {
      newAccountIds.set(name, existing.id);
      return existing.id;
    }
    const id = makeId('acc');
    accountsToAdd.push({
      id, name: finalName, type: decision.type || 'debito', color: nextColor(),
      initialBalance: initialBalances.get(name) || 0,
    });
    newAccountIds.set(name, id);
    return id;
  }

  function categoryIdFor(name: string, type: 'expense' | 'income'): string {
    const key = `${name.trim().toLowerCase()}|${type}`;
    if (newCategoryIds.has(key)) return newCategoryIds.get(key)!;
    const existing = existingCategories.find(c => c.type === type && c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      newCategoryIds.set(key, existing.id);
      return existing.id;
    }
    const id = makeId('cat');
    categoriesToAdd.push({ id, name: name.trim(), icon: guessCategoryIcon(name), color: nextColor(), type });
    newCategoryIds.set(key, id);
    return id;
  }

  // Crea/resuelve toda cuenta decidida por el usuario aunque no participe en
  // ninguna transacción (p. ej. una cuenta que solo tuvo un "Initial balance").
  for (const name of Object.keys(accountDecisions)) {
    accountIdFor(name);
  }

  const transactions: Transaction[] = [];
  const installmentPlansToAdd: InstallmentPlan[] = [];
  /* Un `createdAt` correlativo por registro: los conserva en el orden del CSV
     aunque todos entren en el mismo milisegundo. */
  const baseCreatedAt = now ?? Date.now();
  let seq = 0;

  const planBySeriesKey = new Map<string, { id: string; categoryId: string }>();
  if (useOscarConvention && skeleton.msiSeries) {
    for (const [key, series] of skeleton.msiSeries) {
      const catId = categoryIdFor(series.categoryName, 'expense');
      const planId = makeId('msi');
      installmentPlansToAdd.push({
        id: planId, description: series.description, store: series.store,
        totalAmount: series.totalAmount, installmentsCount: series.installmentsCount,
        categoryId: catId, startDate: series.startDate, createdAt: baseCreatedAt + (seq++),
      });
      planBySeriesKey.set(key, { id: planId, categoryId: catId });
    }
  }

  for (const row of skeleton.plain) {
    const accountId = accountIdFor(row.accountName);
    if (!accountId) continue;
    const plan = useOscarConvention && row._msiSeriesKey ? planBySeriesKey.get(row._msiSeriesKey) : null;
    const categoryId = plan ? plan.categoryId : categoryIdFor(row.categoryName, row.type);
    const oscar = useOscarConvention ? row.oscarParsed : null;
    const base = {
      id: makeId('txn'), accountId, categoryId,
      amount: Math.abs(row.amount), date: row.date,
      description: oscar ? oscar.description : row.description,
      store: oscar ? (oscar.store || '') : '',
      createdAt: baseCreatedAt + (seq++),
    };
    /* El gasto lleva además los campos de producto y el vínculo al plan; el
       ingreso no, igual que antes del refactor. `store` sí lo llevan los dos:
       es lo que hay guardado en los perfiles que ya importaron de Monefy. */
    transactions.push(row.type === 'expense'
      ? {
          ...base, type: 'expense',
          installmentPlanId: plan ? plan.id : null,
          size: oscar ? (oscar.size || null) : null,
          brand: oscar ? (oscar.brand || null) : null,
          quantity: oscar ? (oscar.quantity || null) : null,
        }
      : { ...base, type: 'income' });
  }

  for (const row of skeleton.transfers) {
    const fromId = accountIdFor(row.fromName);
    const toId = accountIdFor(row.toName);
    if (fromId && toId) {
      transactions.push({
        id: makeId('txn'), type: 'transfer', fromAccountId: fromId, toAccountId: toId,
        amount: row.amount, date: row.date, description: row.description,
        taggedAsExpense: false, categoryId: null, installmentPlanId: null, store: '',
        createdAt: baseCreatedAt + (seq++),
      });
    } else if (fromId && !toId) {
      // Con una sola pata incluida la transferencia no se puede representar, así
      // que se degrada al movimiento que sí ocurrió en la cuenta que queda.
      const categoryId = categoryIdFor(MONEFY_TRANSFER_CATEGORY, 'expense');
      transactions.push({
        id: makeId('txn'), type: 'expense', accountId: fromId, categoryId,
        amount: row.amount, date: row.date, description: row.description, store: '',
        createdAt: baseCreatedAt + (seq++),
      });
    } else if (!fromId && toId) {
      const categoryId = categoryIdFor(MONEFY_TRANSFER_CATEGORY, 'income');
      transactions.push({
        id: makeId('txn'), type: 'income', accountId: toId, categoryId,
        amount: row.amount, date: row.date, description: row.description,
        createdAt: baseCreatedAt + (seq++),
      });
    }
  }

  return { accountsToAdd, categoriesToAdd, installmentPlansToAdd, transactions };
}
