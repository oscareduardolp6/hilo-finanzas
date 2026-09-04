/* El slice de movimientos: acciones, no campos.

   `transactions`/`tombstones` viven en `data-slice` (se persisten) y
   `sheetOpen`/`formType`/`editingId`/`form` en `ui-slice` (son efímeros). Este
   slice solo aporta las acciones que los mueven, y es el ÚNICO lugar de la
   feature que llama `runRIO`: aquí muere la mónada. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { Transaction, TransactionType } from '../../../shared/domain/types';
import { deleteTransaction, resetTransactions } from '../application/delete-transaction';
import { saveTransaction } from '../application/save-transaction';
import { initialFormState } from '../domain/form';
import type { TransactionFormDraft } from '../domain/form';

export type TransactionsSlice = {
  /** Abre la hoja en blanco para el tipo dado. */
  openAddSheet: (type: TransactionType) => void;
  /** Abre la hoja sembrada con un movimiento existente. */
  openEditSheet: (txn: Transaction) => void;
  closeSheet: () => void;
  /** Cambia de pestaña conservando el importe ya tecleado. */
  switchFormType: (type: TransactionType) => void;

  saveTransaction: (payload: TransactionFormDraft) => void;
  deleteTransaction: (id: string) => void;
  /** Borra todos los movimientos (el botón de Ajustes). No cierra ninguna hoja. */
  resetTransactions: () => void;
};

/** El estado que deja la hoja cerrada. Se compone dentro del mismo `set` que
 *  guarda, para que la persistencia se dispare una sola vez. */
const sheetClosed = { sheetOpen: false, form: null, editingId: null } as const;

export const createTransactionsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], TransactionsSlice> =>
  (set, get) => ({
    openAddSheet: (type) => {
      const { accounts, categories } = get();
      set({
        editingId: null,
        formType: type,
        form: initialFormState(type, accounts, categories),
        sheetOpen: true,
      });
    },

    openEditSheet: (txn) => {
      set({
        editingId: txn.id,
        formType: txn.type,
        // El importe se vuelve string: el borrador es lo que teclea el usuario.
        form: { ...txn, amount: String(txn.amount) },
        sheetOpen: true,
      });
    },

    closeSheet: () => set({ ...sheetClosed }),

    switchFormType: (type) => {
      const { accounts, categories, form } = get();
      const fresh = initialFormState(type, accounts, categories);
      // Conservar el importe es deliberado: teclearlo y luego caer en cuenta de
      // que era un ingreso y no un gasto es el caso común.
      set({ formType: type, form: form ? { ...fresh, amount: form.amount } : fresh });
    },

    saveTransaction: (payload) => {
      const { transactions, formType, editingId } = get();
      const result = runRIO(saveTransaction({ transactions, formType, editingId }, payload), deps);
      set({ transactions: result.transactions, toast: result.toast, ...sheetClosed });
    },

    deleteTransaction: (id) => {
      const { transactions, tombstones } = get();
      const result = runRIO(deleteTransaction({ transactions, tombstones }, id), deps);
      set({
        transactions: result.transactions,
        tombstones: result.tombstones,
        toast: result.toast,
        ...sheetClosed,
      });
    },

    resetTransactions: () => {
      const { transactions, tombstones } = get();
      const result = runRIO(resetTransactions({ transactions, tombstones }), deps);
      set({
        transactions: result.transactions,
        tombstones: result.tombstones,
        toast: result.toast,
      });
    },
  });
