/* Casos de uso de borrado. Los dos dejan lápidas: sin ellas, el dispositivo con
   el que sincronices después vería los movimientos "ausentes" y no "borrados",
   y el merge te los devolvería (ver CLAUDE.md, sync). */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { Tombstone, Transaction } from '../../../shared/domain/types';

export type DeleteTransactionResult = {
  transactions: Transaction[];
  tombstones: Tombstone[];
  toast: string;
};

export type TransactionsState = {
  transactions: Transaction[];
  tombstones: Tombstone[];
};

export const deleteTransaction =
  (state: TransactionsState, id: string): ReaderIO<Deps, DeleteTransactionResult> =>
  (deps) =>
  () => ({
    transactions: state.transactions.filter((t) => t.id !== id),
    tombstones: [...state.tombstones, { id, deletedAt: deps.clock() }],
    toast: 'Movimiento eliminado',
  });

/** Borra TODOS los movimientos (el botón de Ajustes). Una lápida por cada uno,
 *  todas con el mismo instante. */
export const resetTransactions =
  (state: TransactionsState): ReaderIO<Deps, DeleteTransactionResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    return {
      transactions: [],
      tombstones: [...state.tombstones, ...state.transactions.map((t) => ({ id: t.id, deletedAt: now }))],
      toast: 'Movimientos borrados',
    };
  };
