/* Acciones de sincronización. Único lugar de la feature que corre una mónada y
   que hace `match` del `Either`: si `receiveSync` falla, el mensaje sale como
   toast; si va bien, entran las seis colecciones y el punto del peer.

   Las tres acciones de `syncState` son transformaciones puras del dominio, sin
   caso de uso: no tocan IO ni necesitan reloj — el instante lo pone quien las
   llama, porque en "marcar como enviado" es el `exportedAt` del payload que ya
   se generó, no el ahora. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRT, runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { selectDataState } from '../../../app/store/data-slice';
import { messageFor } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { exportFileName } from '../../../shared/infrastructure/download';
import { forgetPeer, markPeerSent, peerName, renameDevice } from '../domain/peers';
import { prepareShare } from '../application/prepare-share';
import type { SharePreview, ShareOptions } from '../application/prepare-share';
import { receiveSync } from '../application/receive-sync';
import type { IncomingSource, ReceiveResult } from '../application/receive-sync';

/* El fallo NO sale como toast, a diferencia del resto de la app: el mensaje
   ("Esto no parece un export de Hilo") habla del texto que el usuario acaba de
   pegar, y va debajo de ese cuadro, no en una barra que tapa la hoja. El
   `Either` igual muere aquí; lo que cruza a la UI es un dato plano. */
export type ReceiveOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Una sesión de escaneo con cámara: la promesa del resultado ya fundido, y
 *  con qué cancelarla al cerrar la hoja o cambiar de pestaña. */
export type QrScan = {
  readonly result: Promise<ReceiveOutcome>;
  readonly cancel: () => void;
};

export type SyncSlice = {
  /** Lee un payload entrante y lo funde. Texto, bytes de QR o archivo. */
  receiveSync: (source: IncomingSource) => Promise<ReceiveOutcome>;
  /** Abre la cámara y funde el primer QR de Hilo que reconozca. */
  scanQr: (video: HTMLVideoElement) => QrScan;
  /** Prepara lo que se mandaría: payload, texto comprimido y QR si cabe.
   *  Devuelve el resultado en vez de guardarlo: es una vista previa, no estado
   *  de la app, y quien la pidió puede haberla descartado ya. */
  prepareShare: (options: ShareOptions) => Promise<SharePreview>;
  copyShareText: (text: string) => Promise<ReceiveOutcome>;
  shareOut: (preview: SharePreview) => Promise<ReceiveOutcome>;
  downloadShare: (preview: SharePreview) => void;
  /** Si el sistema admite compartir; si no, la UI no ofrece el botón. */
  canShare: () => boolean;

  renameDevice: (name: string) => void;
  forgetPeer: (peerId: string) => void;
  /** Sin `at`, el instante lo pone el reloj inyectado. */
  markSent: (peerId: string, at?: number) => void;
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

    scanQr: (video) => {
      const session = deps.qrGateway.scan(video);
      return {
        cancel: session.cancel,
        result: session.result.then(
          (bytes) => get().receiveSync({ kind: 'bytes', bytes }),
          // El gateway ya trae el mensaje bueno: distingue permiso denegado de
          // cámara ausente, que es lo que el usuario necesita para arreglarlo.
          (e: unknown): ReceiveOutcome => ({
            ok: false,
            message: e instanceof Error ? e.message : 'No se pudo abrir la cámara.',
          }),
        ),
      };
    },

    prepareShare: (options) => {
      const { syncState } = get();
      const device = syncState?.deviceId
        ? { id: syncState.deviceId, name: syncState.deviceName }
        : undefined;
      return runRT(prepareShare(selectDataState(get()), { ...options, device }), deps);
    },

    copyShareText: async (text) => {
      try {
        await deps.clipboardGateway.writeText(text);
        return { ok: true };
      } catch {
        return { ok: false, message: 'El navegador no dejó copiar. Usa el archivo.' };
      }
    },

    shareOut: async (preview) => {
      try {
        const contents = JSON.stringify(preview.payload, null, 2);
        await deps.shareGateway.shareFile(exportFileName('sync', deps.clock()), contents, preview.text);
        return { ok: true };
      } catch (e) {
        // Cerrar la hoja del sistema no es un fallo del que avisar.
        if (e && (e as { name?: string }).name === 'AbortError') return { ok: true };
        return { ok: false, message: 'No se pudo compartir.' };
      }
    },

    downloadShare: (preview) => {
      deps.downloadGateway.json(preview.payload, exportFileName('sync', deps.clock()));
    },

    canShare: () => deps.shareGateway.canShare(),

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
      const when = at ?? deps.clock();
      // El nombre se lee ANTES de escribir: el toast habla del peer tal como lo
      // conocía el usuario al pulsar.
      const who = peerName(syncState, peerId) || 'el otro dispositivo';
      set({ syncState: markPeerSent(syncState, peerId, when), toast: `Punto marcado con ${who}` });
    },
  });
