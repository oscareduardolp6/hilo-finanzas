/* El saldo de una cuenta NUNCA se guarda: se deriva plegando los movimientos.

   Es la regla central de esta feature — por eso editar el `initialBalance` de
   una cuenta recalcula su saldo mostrado sin tocar un solo movimiento. */

import type { Account, Transaction } from '../../../shared/domain/types';

/** Saldo por id de cuenta. */
export type Balances = Record<string, number>;

/* Los tipos de entrada son deliberadamente laxos: hay datos guardados por
   versiones anteriores donde `initialBalance` es un string (venía de un
   `<input>`) o simplemente no está. `Number(x) || 0` los absorbe, y el tipo
   tiene que admitir lo mismo que el código tolera. */
type BalanceInput = Pick<Account, 'id'> & { initialBalance?: unknown };

export function computeAccountBalance(account: BalanceInput, transactions: Transaction[]): number {
  let bal = Number(account.initialBalance) || 0;
  for (const t of transactions) {
    if (t.type === 'income' && t.accountId === account.id) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === account.id) bal -= t.amount;
    else if (t.type === 'transfer') {
      // Sin `else`: una transferencia de una cuenta a sí misma se neutraliza.
      if (t.fromAccountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

export function computeBalances(accounts: BalanceInput[], transactions: Transaction[]): Balances {
  const map: Balances = {};
  for (const a of accounts) map[a.id] = computeAccountBalance(a, transactions);
  return map;
}

/** Suma de todos los saldos. Una transferencia no lo mueve: sale de una cuenta
 *  y entra en otra, incluso si está marcada como gasto. */
export function computeTotalBalance(balances: Balances): number {
  return Object.values(balances).reduce((s, v) => s + v, 0);
}

/** Una cuenta con movimientos no se puede borrar: dejaría huérfanos que ninguna
 *  vista sabe pintar. Es la condición del botón "Eliminar cuenta". */
export function accountHasTransactions(id: string, transactions: Transaction[]): boolean {
  // Se miran los tres campos sin ramificar por `type`, igual que el original: un
  // registro guardado por una versión vieja puede traer combinaciones que la
  // unión de tipos ya no admite, y perder una referencia aquí permitiría borrar
  // una cuenta que sí tiene movimientos.
  return transactions.some((t) => {
    const anyAccount = t as { accountId?: string; fromAccountId?: string; toAccountId?: string };
    return anyAccount.accountId === id || anyAccount.fromAccountId === id || anyAccount.toAccountId === id;
  });
}
