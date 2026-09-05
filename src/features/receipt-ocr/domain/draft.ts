/* Lo que devuelve el modelo y lo que la hoja de revisión edita.

   `ReceiptScan` es lo que llega de la API: datos ajenos, así que todo campo va
   opcional y `buildReceiptDraft` no confía en ninguno — de ahí los `Number()`,
   los `Array.isArray` y el fallback de categoría. `ReceiptDraft` es lo que el
   usuario ve y corrige, con montos como strings porque son inputs. */

import { todayIso } from '../../../shared/domain/dates';
import { uid } from '../../../shared/domain/ids';
import type { IdGenerator } from '../../../shared/domain/ports';
import type { Category } from '../../../shared/domain/types';

/** Un renglón tal como lo emite el modelo. */
export type ScanLineItem = {
  description?: string;
  listPrice?: number;
  quantity?: number | null;
  categoryId?: string | null;
};

export type ScanDiscount = {
  label?: string;
  amount?: number;
};

export type ReceiptScan = {
  store?: string;
  date?: string;
  currency?: string;
  lineItems?: ScanLineItem[];
  discounts?: ScanDiscount[];
  ticketTotal?: number;
};

/** Un artículo en la hoja de revisión. `amount` es string: es un input. */
export type ReceiptRow = {
  id: string;
  description: string;
  amount: string | number;
  quantity: string;
  categoryId: string;
  /** `null` = va a la cuenta principal del ticket. */
  accountId: string | null;
  included: boolean;
};

export type ReceiptDiscount = {
  id: string;
  label: string;
  amount: string | number;
  accountId: string | null;
  included: boolean;
};

export type ReceiptDraft = {
  store: string;
  date: string;
  ticketTotal: number;
  rows: ReceiptRow[];
  discounts: ReceiptDiscount[];
};

export type BuildDraftOptions = {
  expenseCategories: Category[];
  /* Inyectables para volver la función determinista. Sin ellos se comporta
     igual que antes del refactor, que es lo que llama `test/unit/receipt.test.js`. */
  newId?: IdGenerator;
  today?: string;
};

export function isValidIsoDate(s: unknown): boolean {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function buildReceiptDraft(
  scan: ReceiptScan,
  { expenseCategories, newId, today }: BuildDraftOptions,
): ReceiptDraft {
  const makeId: IdGenerator = newId || uid;
  const fallbackCat = expenseCategories[0] ? expenseCategories[0].id : '';
  const catIds = new Set(expenseCategories.map(c => c.id));
  const rows: ReceiptRow[] = (Array.isArray(scan.lineItems) ? scan.lineItems : []).map(it => ({
    id: makeId('rrow'),
    description: (it.description || '').trim(),
    amount: Math.abs(Number(it.listPrice) || 0),
    quantity: it.quantity != null && Number(it.quantity) ? String(Number(it.quantity)) : '',
    categoryId: catIds.has(it.categoryId as string) ? (it.categoryId as string) : fallbackCat,
    accountId: null,
    included: true,
  }));
  const discounts: ReceiptDiscount[] = (Array.isArray(scan.discounts) ? scan.discounts : []).map(d => ({
    id: makeId('rdsc'),
    label: (d.label || '').trim() || 'Descuento',
    amount: Math.abs(Number(d.amount) || 0),
    accountId: null,
    included: true,
  }));
  return {
    store: (scan.store || '').trim(),
    date: isValidIsoDate(scan.date) ? scan.date! : (today || todayIso()),
    ticketTotal: Math.abs(Number(scan.ticketTotal) || 0),
    rows,
    discounts,
  };
}
