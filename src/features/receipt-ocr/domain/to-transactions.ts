/* De lo que el usuario confirmó en la hoja a movimientos de Hilo.

   Aquí vive el concepto que hace que el escaneo cuadre: los renglones entran a
   PRECIO DE LISTA y cada descuento del ticket entra como un INGRESO en la
   categoría "Descuentos". Así `subtotal − descuento = lo que pagaste` neto en
   `totalBalance`, y de paso queda registrado cuánto se ahorró — que es lo que
   el usuario quiere poder sumar después.

   Un renglón puede además registrarse como transferencia marcada como gasto
   (cuando se pagó con una tarjeta que en Hilo es otra cuenta): cuenta para el
   gasto por categoría sin volver a restar del saldo total. */

import type { Category, NewCategory } from '../../../shared/domain/types';
import type { NewTransaction } from '../../transactions/domain/to-transaction';

/** La categoría de descuentos es semilla, pero hay perfiles anteriores a ella:
 *  si no está, se re-crea con estos valores. */
export const DISCOUNT_CATEGORY: NewCategory = {
  name: 'Descuentos',
  icon: 'Ticket',
  color: '#6FA8A0',
  type: 'income',
};

export type ConfirmedRow = {
  description: string;
  amount: number;
  categoryId: string;
  accountId: string;
  quantity: string;
  /** Registrar como transferencia marcada como gasto en vez de gasto simple. */
  viaTransfer: boolean;
};

export type ConfirmedDiscount = {
  label: string;
  amount: number;
  accountId: string;
};

export type ReceiptPayload = {
  date: string;
  store: string;
  originAccountId: string;
  rows: ConfirmedRow[];
  discounts: ConfirmedDiscount[];
};

/* `NewTransaction` se importa de `transactions/domain/`: "un movimiento antes de
   tener identidad" es un concepto de esa feature, y la regla de dependencias
   permite justo esto — el `domain/` de otra feature, nunca su `ui/`. */

export const findDiscountCategory = (categories: Category[]): Category | undefined =>
  categories.find(c => c.type === 'income' && c.name.trim().toLowerCase() === 'descuentos');

/** Los movimientos del ticket, en el orden en que se agregan: primero los
 *  artículos, después los descuentos. `discountCategoryId` lo resuelve quien
 *  llama, porque puede haber tenido que crear la categoría. */
export function buildReceiptTransactions(
  payload: ReceiptPayload,
  discountCategoryId: string | null,
  today: string,
): NewTransaction[] {
  const built: NewTransaction[] = [];
  const date = payload.date || today;

  for (const r of payload.rows) {
    const amount = parseFloat(String(r.amount)) || 0;
    // Un renglón en cero no es un movimiento: el usuario lo dejó vacío.
    if (amount <= 0) continue;
    const base = { date, description: (r.description || '').trim(), amount };
    const quantity = (r.quantity || '').trim() || null;
    if (r.viaTransfer) {
      built.push({
        ...base, type: 'transfer',
        fromAccountId: payload.originAccountId, toAccountId: r.accountId,
        taggedAsExpense: true, categoryId: r.categoryId, installmentPlanId: null,
        store: payload.store || null, size: null, brand: null, quantity,
      });
    } else {
      built.push({
        ...base, type: 'expense',
        accountId: r.accountId, categoryId: r.categoryId, installmentPlanId: null,
        store: payload.store || null, size: null, brand: null, quantity,
      });
    }
  }

  if (discountCategoryId) {
    for (const d of includedDiscounts(payload)) {
      built.push({
        date,
        description: (d.label || '').trim() || 'Descuento',
        amount: parseFloat(String(d.amount)) || 0,
        type: 'income', accountId: d.accountId, categoryId: discountCategoryId,
      });
    }
  }

  return built;
}

/** Solo los descuentos con monto: uno en cero no se registra. */
export const includedDiscounts = (payload: ReceiptPayload): ConfirmedDiscount[] =>
  payload.discounts.filter(d => (parseFloat(String(d.amount)) || 0) > 0);
