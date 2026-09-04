/* El slice de cuentas: acciones, no campos.

   `accounts` y `tombstones` siguen viviendo en `data-slice` (se persisten) y
   `accountModalOpen`/`editingAccount` en `ui-slice` (son efímeros). Este slice
   solo aporta las acciones que los mueven — es el reparto que decidió el paso 2
   y que siguen los pasos 3–12.

   Es también el ÚNICO lugar de la feature que llama a `runRIO`: aquí muere la
   mónada. De aquí hacia arriba, `saveAccount` es `(input) => void`. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { Account } from '../../../shared/domain/types';
import { deleteAccount } from '../application/delete-account';
import { saveAccount } from '../application/save-account';
import type { AccountInput } from '../application/save-account';

export type AccountsSlice = {
  /** Alta si el input no trae `id`, edición si lo trae. Cierra el modal. */
  saveAccount: (input: AccountInput) => void;
  deleteAccount: (id: string) => void;
  /** `null` abre el formulario en blanco. */
  openAccountForm: (account: Account | null) => void;
  closeAccountForm: () => void;
};

export const createAccountsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], AccountsSlice> =>
  (set, get) => ({
    saveAccount: (input) => {
      const { accounts, toast } = runRIO(saveAccount(get().accounts, input), deps);
      // Un solo `set` donde el legacy hacía cuatro: el suscriptor de
      // persistencia observa las colecciones, así que esto es un guardado y no
      // dos. React ya batcheaba los cuatro dentro del handler, así que de cara
      // al usuario no cambia nada.
      set({ accounts, toast, accountModalOpen: false, editingAccount: null });
    },

    deleteAccount: (id) => {
      const { accounts, tombstones, toast } = runRIO(
        deleteAccount({ accounts: get().accounts, tombstones: get().tombstones }, id),
        deps,
      );
      set({ accounts, tombstones, toast, accountModalOpen: false, editingAccount: null });
    },

    openAccountForm: (account) => set({ editingAccount: account, accountModalOpen: true }),
    closeAccountForm: () => set({ accountModalOpen: false, editingAccount: null }),
  });
