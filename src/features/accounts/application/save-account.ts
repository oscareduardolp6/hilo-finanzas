/* Caso de uso: crear o editar una cuenta.

   `ReaderIO` y no `Reader`: necesita el reloj (`updatedAt`) y, al crear, un id.
   Invocar `saveAccount(...)` NO guarda nada — devuelve un valor que describe el
   cambio. El efecto ocurre cuando el slice le aplica `runRIO(..., deps)`, que es
   el único punto de run de toda la app (ver src/app/run.ts). */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { Account, AccountTypeId } from '../../../shared/domain/types';

/** Lo que emite el formulario: sin `id` es alta, con `id` es edición. */
export type AccountInput = {
  id?: string;
  name: string;
  type: AccountTypeId;
  color: string;
  initialBalance: number;
};

export type SaveAccountResult = {
  accounts: Account[];
  /** Texto exacto del toast: es contrato de los tests de integración. */
  toast: string;
};

export const saveAccount =
  (accounts: Account[], input: AccountInput): ReaderIO<Deps, SaveAccountResult> =>
  (deps) =>
  () => {
    const now = deps.clock();
    const { id, ...fields } = input;

    if (id) {
      return {
        accounts: accounts.map((a) => (a.id === id ? { ...a, ...fields, id, updatedAt: now } : a)),
        toast: 'Cuenta actualizada',
      };
    }
    // Al final de la lista, no al principio: es el orden en que se pintan.
    return {
      accounts: [...accounts, { id: deps.idGenerator('acc'), ...fields, createdAt: now, updatedAt: now }],
      toast: 'Cuenta creada',
    };
  };
