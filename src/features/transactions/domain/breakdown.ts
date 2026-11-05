/* El desglose de un movimiento: la "cuenta completa" de un ticket.

   La regla que manda todo lo de aquí: **el `amount` del movimiento es la fuente
   de la verdad** — es lo que de verdad se pagó y lo único que mueve saldos. El
   desglose solo reparte ese monto entre categorías:

       amount = Σ renglones + sin especificar − Σ descuentos

   "Sin especificar" no se guarda: se deriva, y es lo que queda del total que
   el usuario no desglosó (va a la categoría del movimiento). Los descuentos son
   renglones propios, no se prorratean: restan de su categoría y cuentan como
   ahorro, nunca como ingreso.

   Puro, sin `Deps`. Lo usan dashboard, historial y beneficios por su `domain/`. */

import { getBreakdown } from '../../../shared/domain/breakdown';
import type {
  BreakdownDiscount, BreakdownItem, Transaction, TransactionBreakdown,
} from '../../../shared/domain/types';

/* `getBreakdown` y `computeTransactionSavings` viven en `shared/domain/` porque
   también los usa `TransactionRow` (shared/ui); se re-exportan aquí para que
   las features los tomen todos de un mismo sitio. */
export { computeTransactionSavings, getBreakdown } from '../../../shared/domain/breakdown';

/* --- Borrador: lo que edita el formulario (strings, porque son inputs) --- */

export type BreakdownItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  /** `null` = hereda la categoría del movimiento. */
  categoryId: string | null;
  size: string;
  brand: string;
};

export type BreakdownDiscountDraft = {
  id: string;
  label: string;
  amount: string;
  categoryId: string | null;
  benefitProgramId: string | null;
};

export type BreakdownDraft = {
  items: BreakdownItemDraft[];
  discounts: BreakdownDiscountDraft[];
};

export const emptyBreakdownDraft = (): BreakdownDraft => ({ items: [], discounts: [] });

export const newItemDraft = (id: string): BreakdownItemDraft => ({
  id, description: '', quantity: '', unitPrice: '', amount: '', categoryId: null, size: '', brand: '',
});

export const newDiscountDraft = (id: string): BreakdownDiscountDraft => ({
  id, label: '', amount: '', categoryId: null, benefitProgramId: null,
});

const toNumber = (v: string | number | null | undefined): number => parseFloat(String(v ?? '')) || 0;

/** Dos decimales, sin ceros de relleno: es lo que se escribe de vuelta en un input. */
const round2 = (n: number): string => String(Math.round(n * 100) / 100);

const numOrNull = (v: string): number | null => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const textOrNull = (v: string | null | undefined): string | null => (v || '').trim() || null;

/** Persistido → borrador. `null`/ausente → sin desglose. */
export function breakdownToDraft(b: TransactionBreakdown | null | undefined): BreakdownDraft | null {
  if (!b) return null;
  return {
    items: (Array.isArray(b.items) ? b.items : []).map(i => ({
      id: i.id,
      description: i.description || '',
      quantity: i.quantity != null ? String(i.quantity) : '',
      unitPrice: i.unitPrice != null ? String(i.unitPrice) : '',
      amount: String(i.amount ?? ''),
      categoryId: i.categoryId ?? null,
      size: i.size || '',
      brand: i.brand || '',
    })),
    discounts: (Array.isArray(b.discounts) ? b.discounts : []).map(d => ({
      id: d.id,
      label: d.label || '',
      amount: String(d.amount ?? ''),
      categoryId: d.categoryId ?? null,
      benefitProgramId: d.benefitProgramId ?? null,
    })),
  };
}

/** Borrador → persistido. `null` se queda en `null`: el desglose es opt-in. */
export function draftToBreakdown(d: BreakdownDraft | null | undefined): TransactionBreakdown | null {
  if (!d) return null;
  const items: BreakdownItem[] = d.items.map(i => ({
    id: i.id,
    description: (i.description || '').trim(),
    amount: toNumber(i.amount),
    quantity: numOrNull(i.quantity),
    unitPrice: numOrNull(i.unitPrice),
    categoryId: i.categoryId || null,
    size: textOrNull(i.size),
    brand: textOrNull(i.brand),
  }));
  const discounts: BreakdownDiscount[] = d.discounts.map(x => ({
    id: x.id,
    label: (x.label || '').trim(),
    amount: toNumber(x.amount),
    categoryId: x.categoryId || null,
    benefitProgramId: x.benefitProgramId || null,
  }));
  return { items, discounts };
}

/** Editar cantidad, precio unitario o total mantiene los tres coherentes:
 *  con cantidad y unitario, el total se calcula; si se teclea el total con
 *  cantidad presente, se recalcula el unitario. */
export function patchItemDraft(
  item: BreakdownItemDraft,
  field: 'quantity' | 'unitPrice' | 'amount',
  value: string,
): BreakdownItemDraft {
  const next = { ...item, [field]: value };
  const q = toNumber(next.quantity);
  if (field === 'quantity' || field === 'unitPrice') {
    const u = toNumber(next.unitPrice);
    if (q > 0 && u > 0) next.amount = round2(q * u);
  } else if (q > 0 && toNumber(value) > 0) {
    next.unitPrice = round2(toNumber(value) / q);
  }
  return next;
}

/* --- Derivados --- */

type AmountLike = { amount: string | number };

export type BreakdownSummary = {
  /** Σ renglones capturados. */
  itemsTotal: number;
  discountsTotal: number;
  /** Lo que queda del total sin desglosar. Negativo = los renglones se pasan. */
  unspecified: number;
  /** Antes de descuentos: `amount + Σ descuentos`. */
  subtotal: number;
  /** Cuadra si "sin especificar" no queda negativo (con medio centavo de margen). */
  isBalanced: boolean;
};

export function computeBreakdownSummary(
  amount: number,
  breakdown: { items: AmountLike[]; discounts: AmountLike[] },
): BreakdownSummary {
  const itemsTotal = breakdown.items.reduce((s, i) => s + toNumber(i.amount), 0);
  const discountsTotal = breakdown.discounts.reduce((s, d) => s + toNumber(d.amount), 0);
  const subtotal = amount + discountsTotal;
  const unspecified = subtotal - itemsTotal;
  return { itemsTotal, discountsTotal, unspecified, subtotal, isBalanced: unspecified >= -0.005 };
}

export type CategoryPortion = { categoryId: string | null; amount: number };

/** Cómo reparte un movimiento su gasto entre categorías, con signo (los
 *  descuentos restan). Siempre suma `amount`. Sin desglose es una sola porción
 *  — exactamente lo que se contaba antes de esta feature. Solo cuentan el gasto
 *  y la transferencia marcada como gasto; el resto no reparte nada. */
export function computeCategoryPortions(t: Transaction): CategoryPortion[] {
  let parent: string | null;
  if (t.type === 'expense') parent = t.categoryId || null;
  else if (t.type === 'transfer' && t.taggedAsExpense) parent = t.categoryId || null;
  else return [];

  const b = getBreakdown(t);
  if (!b) return [{ categoryId: parent, amount: t.amount }];

  const portions: CategoryPortion[] = b.items.map(i => ({ categoryId: i.categoryId || parent, amount: i.amount }));
  const { unspecified } = computeBreakdownSummary(t.amount, b);
  if (Math.abs(unspecified) > 0.005) portions.push({ categoryId: parent, amount: unspecified });
  for (const d of b.discounts) portions.push({ categoryId: d.categoryId || parent, amount: -d.amount });
  return portions;
}

/** Los textos del desglose que entran en la búsqueda del historial. */
export function breakdownSearchText(t: Transaction): string[] {
  const b = getBreakdown(t);
  if (!b) return [];
  return [
    ...b.items.flatMap(i => [i.description, i.brand || '']),
    ...b.discounts.map(d => d.label),
  ].filter(Boolean);
}
