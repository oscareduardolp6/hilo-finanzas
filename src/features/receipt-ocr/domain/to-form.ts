/* Del ticket leído al borrador del formulario de movimiento.

   El escaneo ya no genera movimientos por su cuenta: llena la misma hoja de
   "Nuevo movimiento" que la captura manual, con el desglose activado, y el
   usuario revisa y guarda ahí. Así un ticket escaneado es UN gasto por lo
   realmente pagado, con un renglón por artículo y los descuentos como ahorro
   (no como ingreso), igual que uno capturado a mano.

   Lo que el ticket no cuadra lo resuelve el editor del desglose: si los
   artículos suman menos que el total, la diferencia sale como "Sin
   especificar"; si suman más (un renglón repetido que se le escapó al modelo,
   o un total mal leído), el formulario no deja guardar hasta corregirlo.

   `TransactionFormDraft` e `initialFormState` son de `transactions/domain/`: la
   regla de dependencias permite el `domain/` de otra feature. */

import type { IdGenerator } from '../../../shared/domain/ports';
import type { Account, Category } from '../../../shared/domain/types';
import type { BreakdownDiscountDraft, BreakdownItemDraft } from '../../transactions/domain/breakdown';
import { initialFormState } from '../../transactions/domain/form';
import type { TransactionFormDraft } from '../../transactions/domain/form';
import type { ReceiptDraft } from './draft';

export type ToFormOptions = {
  accounts: Account[];
  categories: Category[];
  newId: IdGenerator;
};

const toNumber = (v: string | number): number => parseFloat(String(v)) || 0;
const money = (n: number): string => String(Math.round(n * 100) / 100);

/** La categoría que se lleva más dinero del ticket: la del movimiento, que
 *  heredan los renglones sin categoría propia. */
export function dominantCategoryId(draft: ReceiptDraft, fallback: string): string {
  const byCategory = new Map<string, number>();
  for (const r of draft.rows) {
    if (!r.categoryId) continue;
    byCategory.set(r.categoryId, (byCategory.get(r.categoryId) || 0) + toNumber(r.amount));
  }
  let best = fallback;
  let bestAmount = -Infinity;
  for (const [id, amount] of byCategory) {
    if (amount > bestAmount) { best = id; bestAmount = amount; }
  }
  return best;
}

export function receiptToFormDraft(
  draft: ReceiptDraft,
  { accounts, categories, newId }: ToFormOptions,
): TransactionFormDraft {
  const base = initialFormState('expense', accounts, categories);
  const parent = dominantCategoryId(draft, base.categoryId || '');

  const items: BreakdownItemDraft[] = draft.rows
    .filter(r => toNumber(r.amount) > 0)
    .map(r => ({
      id: newId('bitem'),
      description: r.description,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      amount: money(toNumber(r.amount)),
      // La del movimiento se hereda (`null`): cambiarla luego arrastra a todos
      // los renglones que el usuario no tocó.
      categoryId: r.categoryId && r.categoryId !== parent ? r.categoryId : null,
      size: '',
      brand: '',
    }));

  const discounts: BreakdownDiscountDraft[] = draft.discounts
    .filter(d => toNumber(d.amount) > 0)
    .map(d => ({
      id: newId('bdisc'),
      label: d.label,
      amount: money(toNumber(d.amount)),
      categoryId: null,
      benefitProgramId: null,
    }));

  const sumItems = items.reduce((s, i) => s + toNumber(i.amount), 0);
  const sumDiscounts = discounts.reduce((s, d) => s + toNumber(d.amount), 0);
  // El total impreso es lo que de verdad se pagó. Si el modelo no lo vio, lo
  // mejor que hay es lo que suman los renglones.
  const paid = draft.ticketTotal > 0 ? draft.ticketTotal : Math.max(0, sumItems - sumDiscounts);

  return {
    ...base,
    date: draft.date || base.date,
    store: draft.store,
    description: draft.store || 'Ticket',
    amount: paid > 0 ? money(paid) : '',
    categoryId: parent,
    breakdown: items.length || discounts.length ? { items, discounts } : null,
  };
}
