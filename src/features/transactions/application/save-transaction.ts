/* Caso de uso: crear o editar un movimiento.

   `ReaderIO`: necesita el reloj (marcas de tiempo y el "hoy" por defecto) y,
   al crear, un id. Invocarlo no hace nada — devuelve un valor; el efecto
   ocurre cuando el slice le aplica `runRIO(..., deps)`. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import { isoFromEpoch } from '../../../shared/domain/dates';
import type { Transaction, TransactionType } from '../../../shared/domain/types';
import type { TransactionFormDraft } from '../domain/form';
import { toTransaction } from '../domain/to-transaction';

export type SaveTransactionInput = {
  transactions: Transaction[];
  /** El tipo lo manda la pestaña del formulario, no el borrador. */
  formType: TransactionType;
  /** `null` = alta. */
  editingId: string | null;
};

export type SaveTransactionResult = {
  transactions: Transaction[];
  /** Texto exacto del toast: es contrato de los tests de integración. */
  toast: string;
};

export const saveTransaction =
  (state: SaveTransactionInput, payload: TransactionFormDraft): ReaderIO<Deps, SaveTransactionResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const fields = toTransaction(state.formType, payload, isoFromEpoch(now));

    if (state.editingId) {
      // `{ ...t, ...fields }` y no `fields` a secas: conserva `createdAt` y
      // cualquier campo que una versión futura haya añadido al registro.
      return {
        transactions: state.transactions.map((t) =>
          t.id === state.editingId ? ({ ...t, ...fields, updatedAt: now } as Transaction) : t,
        ),
        toast: 'Movimiento actualizado',
      };
    }

    return {
      transactions: [
        ...state.transactions,
        { ...fields, id: deps.idGenerator('txn'), createdAt: now, updatedAt: now } as Transaction,
      ],
      toast: 'Movimiento agregado',
    };
  };
