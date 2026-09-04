/* Selectores de la feature. Otras features pueden importarlos (el dashboard
   necesita los saldos); lo que nunca pueden importar es su `ui/`.

   Los que devuelven un objeto nuevo — `selectBalances` — NO se pasan a
   `useHiloStore`: zustand v5 compara por identidad y entraría en bucle. Se usan
   dentro de un `useMemo` sobre las colecciones, que es lo que hacía `App`. */

import type { HiloStore } from '../../../app/store';
import type { Account, Transaction } from '../../../shared/domain/types';
import { accountHasTransactions, computeBalances, computeTotalBalance } from '../domain/balance';
import type { Balances } from '../domain/balance';

export const selectAccounts = (s: HiloStore): Account[] => s.accounts;
export const selectAccountModalOpen = (s: HiloStore): boolean => s.accountModalOpen;
export const selectEditingAccount = (s: HiloStore): Account | null => s.editingAccount;

/** Deriva los saldos. Envuélvelo en `useMemo`: devuelve un objeto nuevo. */
export const selectBalances = (s: { accounts: Account[]; transactions: Transaction[] }): Balances =>
  computeBalances(s.accounts, s.transactions);

export const selectTotalBalance = (s: { accounts: Account[]; transactions: Transaction[] }): number =>
  computeTotalBalance(selectBalances(s));

/** Condición del botón "Eliminar cuenta". Devuelve un booleano, así que sí es
 *  seguro pasarlo directo a `useHiloStore`. */
export const selectEditingAccountCanDelete = (s: HiloStore): boolean =>
  s.editingAccount ? !accountHasTransactions(s.editingAccount.id, s.transactions) : false;
