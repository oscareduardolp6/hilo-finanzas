/* Borrador de formulario → movimiento. La función más cargada de reglas de
   negocio de Hilo, y por eso vive en `domain/`: pura, sin `Deps`, sin reloj.

   Las tres ramas no son simetría cosmética — cada tipo guarda campos distintos,
   y en la transferencia el flag `taggedAsExpense` decide cuáles sobreviven:
   con el tag apagado, categoría, tienda y detalles de producto se fuerzan a
   `null` para que un dato viejo no quede colgando cuando el usuario desmarca. */

import type { Transaction, TransactionType } from '../../../shared/domain/types';
import type { TransactionFormDraft } from './form';

/* `Omit` sobre una unión colapsa a las claves COMUNES de sus miembros, que aquí
   dejaría fuera `accountId`, `fromAccountId` y compañía. La versión distributiva
   aplica el `Omit` a cada miembro por separado y conserva la unión. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Un movimiento sin identidad ni marcas de tiempo: eso lo pone el caso de uso,
 *  que es quien tiene el reloj y el generador de ids. */
export type NewTransaction = DistributiveOmit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

/** `'  '` → `null`. Hilo guarda ausencia como `null`, nunca como cadena vacía. */
const trimmedOrNull = (v: string | null | undefined): string | null =>
  (v || '').trim() || null;

export function toTransaction(
  formType: TransactionType,
  payload: TransactionFormDraft,
  /** "Hoy" ya resuelto por quien tiene el reloj; se usa si el form no trae fecha. */
  today: string,
): NewTransaction {
  const amount = parseFloat(payload.amount);
  const base = {
    date: payload.date || today,
    description: (payload.description || '').trim(),
    amount,
  };

  if (formType === 'expense') {
    return {
      ...base,
      type: 'expense',
      accountId: payload.accountId ?? '',
      categoryId: payload.categoryId ?? '',
      store: trimmedOrNull(payload.store),
      // Un gasto simple también puede abonar a un plan MSI.
      installmentPlanId: payload.installmentPlanId || null,
      size: trimmedOrNull(payload.size),
      brand: trimmedOrNull(payload.brand),
      quantity: trimmedOrNull(payload.quantity),
    };
  }

  if (formType === 'income') {
    return {
      ...base,
      type: 'income',
      accountId: payload.accountId ?? '',
      categoryId: payload.categoryId ?? '',
      benefitProgramId: payload.benefitProgramId || null,
    };
  }

  // Una transferencia solo cuenta como abono a MSI si además está marcada como
  // gasto: si no, no hay nada que descontar del plan.
  const isMsi = !!(payload.taggedAsExpense && payload.installmentPlanId);
  return {
    ...base,
    type: 'transfer',
    fromAccountId: payload.fromAccountId ?? '',
    toAccountId: payload.toAccountId ?? '',
    taggedAsExpense: !!payload.taggedAsExpense,
    categoryId: payload.taggedAsExpense ? (payload.categoryId ?? null) : null,
    installmentPlanId: isMsi ? (payload.installmentPlanId ?? null) : null,
    // La tienda solo aplica al gasto suelto: si es MSI, la tienda es la del plan.
    store: (payload.taggedAsExpense && !isMsi) ? trimmedOrNull(payload.store) : null,
    size: payload.taggedAsExpense ? trimmedOrNull(payload.size) : null,
    brand: payload.taggedAsExpense ? trimmedOrNull(payload.brand) : null,
    quantity: payload.taggedAsExpense ? trimmedOrNull(payload.quantity) : null,
  };
}
