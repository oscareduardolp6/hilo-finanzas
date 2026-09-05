/* De renglones de Monefy a lo que la hoja de revisión enseña: qué cuentas
   aparecen, en qué rango de fechas, cuántas transferencias se pudieron aparear
   y qué series de MSI se dedujeron de la convención de Oscar.

   Lo que devuelve tiene dos mitades: la que se pinta (`accounts`, conteos,
   `dateRange`) y el `skeleton`, materia prima para `buildMonefyImportPlan` que
   la UI solo transporta. Sigue siendo dominio: nada de esto crea ids ni mira el
   reloj — eso pasa al construir el plan. */

import type { AccountTypeId } from '../../../shared/domain/types';
import { MONEFY_TRANSFER_CATEGORY } from './csv';
import type { MonefyRow } from './csv';
import { guessAccountType } from './guess';
import { parseOscarDescription } from './oscar';
import type { OscarParsed } from './oscar';

export type MonefyAccountPreview = {
  name: string;
  suggestedType: AccountTypeId;
  /** Solo aparece como la otra pata de una transferencia: seguramente una
   *  cuenta renombrada o cerrada, y por eso se avisa antes de crearla. */
  isGhost: boolean;
};

export type MonefyPlainRow = {
  date: string;
  accountName: string;
  categoryName: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  oscarParsed: OscarParsed;
  /** Orden de aparición; desempata al ordenar una serie de MSI por fecha. */
  _idx?: number;
  /** Qué serie de MSI la reclama, si la convención de Oscar detectó una. */
  _msiSeriesKey?: string;
};

export type MonefyTransferRow = {
  date: string;
  fromName: string;
  toName: string;
  amount: number;
  description: string;
};

export type MonefyMsiSeries = {
  accountName: string;
  description: string;
  store: string;
  categoryName: string;
  installmentsCount: number;
  totalAmount: number;
  startDate: string;
};

export type MonefySkeleton = {
  plain: MonefyPlainRow[];
  transfers: MonefyTransferRow[];
  msiSeries: Map<string, MonefyMsiSeries>;
};

export type MonefyPreview = {
  accounts: MonefyAccountPreview[];
  dateRange: { min: string | null; max: string | null };
  transactionCount: number;
  transferCount: number;
  initialBalances: Map<string, number>;
  skeleton: MonefySkeleton;
  oscarConvention: {
    seriesCount: number;
    transactionsWithFraction: number;
    transactionsWithDash: number;
  };
};

type ToRow = Extract<MonefyRow, { kind: 'to' }>;

export function buildMonefyImportPreview(rows: MonefyRow[]): MonefyPreview {
  const accountsByName = new Map<string, MonefyAccountPreview>();
  function ensureAccount(name: string, appearsDirectly: boolean): MonefyAccountPreview {
    let entry = accountsByName.get(name);
    if (!entry) {
      entry = { name, suggestedType: guessAccountType(name), isGhost: !appearsDirectly };
      accountsByName.set(name, entry);
    } else if (appearsDirectly) {
      entry.isGhost = false;
    }
    return entry;
  }

  const initialBalances = new Map<string, number>();
  const plain: MonefyPlainRow[] = [];
  const toRows: ToRow[] = [];
  const fromRows: Extract<MonefyRow, { kind: 'from' }>[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of rows) {
    ensureAccount(row.account, true);
    if (!minDate || row.date < minDate) minDate = row.date;
    if (!maxDate || row.date > maxDate) maxDate = row.date;
    if (row.kind === 'initial') {
      initialBalances.set(row.account, row.amount);
    } else if (row.kind === 'to') {
      ensureAccount(row.otherAccount, false);
      toRows.push(row);
    } else if (row.kind === 'from') {
      ensureAccount(row.otherAccount, false);
      fromRows.push(row);
    } else {
      plain.push({
        date: row.date, accountName: row.account, categoryName: row.category,
        type: row.amount < 0 ? 'expense' : 'income', amount: row.amount,
        description: row.description, _idx: plain.length,
        oscarParsed: parseOscarDescription(row.description),
      });
    }
  }

  /* Series de MSI: varios gastos de la misma cuenta con la misma descripción y
     el mismo denominador son pagos del mismo plan. El total se extrapola del
     último numerador — "voy 3 de 6 y llevo pagados $450" ⇒ el plan es de $900. */
  const msiSeries = new Map<string, MonefyMsiSeries>();
  const seriesRows = new Map<string, MonefyPlainRow[]>();
  for (const p of plain) {
    if (p.type !== 'expense' || p.oscarParsed.numerator == null) continue;
    const key = `${p.accountName}||${p.oscarParsed.description.toLowerCase()}||${p.oscarParsed.denominator}`;
    if (!seriesRows.has(key)) seriesRows.set(key, []);
    seriesRows.get(key)!.push(p);
  }
  for (const [key, entries] of seriesRows) {
    entries.sort((a, b) => a.date.localeCompare(b.date) || (a._idx ?? 0) - (b._idx ?? 0));
    const first = entries[0]!;
    const categoryCounts = new Map<string, number>();
    for (const e of entries) categoryCounts.set(e.categoryName, (categoryCounts.get(e.categoryName) || 0) + 1);
    let categoryName = first.categoryName;
    let bestCount = 0;
    for (const [c, n] of categoryCounts) { if (n > bestCount) { bestCount = n; categoryName = c; } }
    let store = '';
    for (const e of entries) { if (e.oscarParsed.store) { store = e.oscarParsed.store; break; } }
    const paidSoFar = entries.reduce((s, e) => s + Math.abs(e.amount), 0);
    const finalNumerator = entries[entries.length - 1]!.oscarParsed.numerator!;
    const denominator = first.oscarParsed.denominator!;
    const totalAmount = finalNumerator > 0 ? paidSoFar * denominator / finalNumerator : paidSoFar;
    msiSeries.set(key, {
      accountName: first.accountName, description: first.oscarParsed.description,
      store, categoryName, installmentsCount: denominator, totalAmount, startDate: first.date,
    });
    for (const e of entries) e._msiSeriesKey = key;
  }

  /* Aparear transferencias: Monefy escribe las dos patas por separado, así que
     se juntan por fecha + monto + par de cuentas. La que se queda sin pareja se
     DEGRADA a gasto o ingreso en la categoría "Transferencias" — perder el
     movimiento sería peor que perder que fuera una transferencia. */
  function pairKey(date: string, amount: number, fromName: string, toName: string): string {
    return `${date}|${Math.abs(amount)}|${fromName}|${toName}`;
  }

  const toQueues = new Map<string, ToRow[]>();
  for (const row of toRows) {
    const key = pairKey(row.date, row.amount, row.account, row.otherAccount);
    if (!toQueues.has(key)) toQueues.set(key, []);
    toQueues.get(key)!.push(row);
  }

  const transfers: MonefyTransferRow[] = [];
  const degraded: MonefyPlainRow[] = [];
  for (const row of fromRows) {
    const key = pairKey(row.date, row.amount, row.otherAccount, row.account);
    const queue = toQueues.get(key);
    if (queue && queue.length) {
      const toRow = queue.shift()!;
      transfers.push({
        date: row.date, fromName: row.otherAccount, toName: row.account,
        amount: Math.abs(row.amount), description: row.description || toRow.description,
      });
    } else {
      degraded.push({
        date: row.date, accountName: row.account, categoryName: MONEFY_TRANSFER_CATEGORY,
        type: 'income', amount: Math.abs(row.amount), description: row.description,
        oscarParsed: parseOscarDescription(row.description),
      });
    }
  }
  for (const queue of toQueues.values()) {
    for (const row of queue) {
      degraded.push({
        date: row.date, accountName: row.account, categoryName: MONEFY_TRANSFER_CATEGORY,
        type: 'expense', amount: Math.abs(row.amount), description: row.description,
        oscarParsed: parseOscarDescription(row.description),
      });
    }
  }

  return {
    accounts: Array.from(accountsByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    dateRange: { min: minDate, max: maxDate },
    transactionCount: plain.length + degraded.length + transfers.length,
    transferCount: transfers.length,
    initialBalances,
    skeleton: { plain: [...plain, ...degraded], transfers, msiSeries },
    oscarConvention: {
      seriesCount: msiSeries.size,
      transactionsWithFraction: plain.filter(p => p.oscarParsed.numerator != null).length,
      transactionsWithDash: plain.filter(p => p.oscarParsed.store || p.oscarParsed.size || p.oscarParsed.brand || p.oscarParsed.quantity).length,
    },
  };
}
