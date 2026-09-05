/* Acciones de sincronización. Único lugar de la feature que corre una mónada y
   que hace `match` del `Either`: si `receiveSync` falla, el mensaje sale como
   toast; si va bien, entran las cinco colecciones y el punto del peer.

   Las tres acciones de `syncState` son transformaciones puras del dominio, sin
   caso de uso: no tocan IO ni necesitan reloj — el instante lo pone quien las
   llama, porque en "marcar como enviado" es el `exportedAt` del payload que ya
   se generó, no el ahora. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { selectDataState } from '../../../app/store/data-slice';
import { messageFor } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { forgetPeer, markPeerSent, peerName, renameDevice } from '../domain/peers';
import { receiveSync } from '../application/receive-sync';
import type { IncomingSource, ReceiveResult } from '../application/receive-sync';

/* El fallo NO sale como toast, a diferencia del resto de la app: el mensaje
   ("Esto no parece un export de Hilo") habla del texto que el usuario acaba de
   pegar, y va debajo de ese cuadro, no en una barra que tapa la hoja. El
   `Either` igual muere aquí; lo que cruza a la UI es un dato plano. */
export type ReceiveOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export type SyncSlice = {
  /** Lee un payload entrante y lo funde. */
  receiveSync: (source: IncomingSource) => Promise<ReceiveOutcome>;
  renameDevice: (name: string) => void;
  forgetPeer: (peerId: string) => void;
  markSent: (peerId: string, at: number) => void;
};

export const createSyncSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], SyncSlice> =>
  (set, get) => ({
    receiveSync: async (source) => {
      const state = get();
      const result = await runRTE(receiveSync(selectDataState(state), state.syncState, source), deps);
      return pipe(
        result,
        E.match(
          (error: HiloError): ReceiveOutcome => ({ ok: false, message: messageFor(error) }),
          ({ data, syncState, toast }: ReceiveResult): ReceiveOutcome => {
            set({ ...data, ...(syncState ? { syncState } : {}), toast });
            return { ok: true };
          },
        ),
      );
    },

    renameDevice: (name) => {
      const { syncState } = get();
      if (!syncState) return;
      set({ syncState: renameDevice(syncState, name) });
    },

    forgetPeer: (peerId) => {
      const { syncState } = get();
      if (!syncState) return;
      set({ syncState: forgetPeer(syncState, peerId) });
    },

    markSent: (peerId, at) => {
      const { syncState } = get();
      if (!peerId || !syncState) return;
      // El nombre se lee ANTES de escribir: el toast habla del peer tal como lo
      // conocía el usuario al pulsar.
      const who = peerName(syncState, peerId) || 'el otro dispositivo';
      set({ syncState: markPeerSent(syncState, peerId, at), toast: `Punto marcado con ${who}` });
    },
  });
