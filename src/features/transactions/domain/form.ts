/* El BORRADOR del formulario de movimiento.

   No es un `Transaction`: los inputs producen strings (`amount`, `size`…) y
   varios campos están a medio llenar mientras se escribe. Se convierte en
   movimiento al guardar, en `to-transaction.ts`.

   Todos los campos van opcionales porque cada tipo de movimiento usa un
   subconjunto distinto, y porque al editar el borrador se siembra con el
   movimiento entero (`{ ...txn, amount: String(txn.amount) }`), que trae
   campos que el formulario no toca. */

import { todayIso } from '../../../shared/domain/dates';
import type { Account, Category, TransactionType } from '../../../shared/domain/types';

export type TransactionFormDraft = {
  date: string;
  description: string;
  /** String, no número: es el valor crudo del `<input>`. */
  amount: string;
  store?: string | null;
  accountId?: string;
  categoryId?: string | null;
  fromAccountId?: string;
  toAccountId?: string;
  taggedAsExpense?: boolean;
  installmentPlanId?: string | null;
  size?: string | null;
  brand?: string | null;
  quantity?: string | null;
  /* Presentes solo al editar, sembrados desde el movimiento. */
  id?: string;
  type?: TransactionType;
  createdAt?: number;
  updatedAt?: number;
};

/** El borrador en blanco para un tipo de movimiento: preselecciona la primera
 *  cuenta y la primera categoría del tipo correspondiente. */
export function initialFormState(
  type: TransactionType,
  accounts: Account[],
  categories: Category[],
): TransactionFormDraft {
  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const base = { date: todayIso(), description: '', amount: '', store: '' };
  if (type === 'expense') {
    return { ...base, accountId: accounts[0] ? accounts[0].id : '', categoryId: expenseCats[0] ? expenseCats[0].id : '', installmentPlanId: null, size: '', brand: '', quantity: '' };
  }
  if (type === 'income') {
    return { ...base, accountId: accounts[0] ? accounts[0].id : '', categoryId: incomeCats[0] ? incomeCats[0].id : '' };
  }
  // Transferencia: la segunda cuenta por defecto, o la primera si solo hay una.
  const secondAccount = accounts[1] ? accounts[1].id : (accounts[0] ? accounts[0].id : '');
  return { ...base, fromAccountId: accounts[0] ? accounts[0].id : '', toAccountId: secondAccount, taggedAsExpense: false, categoryId: '', installmentPlanId: null, size: '', brand: '', quantity: '' };
}
