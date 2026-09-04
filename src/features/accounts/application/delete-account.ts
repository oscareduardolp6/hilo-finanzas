/* Caso de uso: eliminar una cuenta.

   Deja una lápida además de quitarla de la colección. Sin ella, el dispositivo
   que sincronice después vería la cuenta "ausente" y no "borrada", y el merge
   se la devolvería: una ausencia nunca es un borrado (ver CLAUDE.md, sync). */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { Account, Tombstone } from '../../../shared/domain/types';

export type DeleteAccountResult = {
  accounts: Account[];
  tombstones: Tombstone[];
  toast: string;
};

export const deleteAccount =
  (
    state: { accounts: Account[]; tombstones: Tombstone[] },
    id: string,
  ): ReaderIO<Deps, DeleteAccountResult> =>
  (deps) =>
  () => ({
    accounts: state.accounts.filter((a) => a.id !== id),
    tombstones: [...state.tombstones, { id, deletedAt: deps.clock() }],
    toast: 'Cuenta eliminada',
  });
