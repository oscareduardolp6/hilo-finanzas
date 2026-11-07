/* Acciones del escaneo de tickets: leer las fotos y probar la clave.

   Único punto de la feature que corre una mónada y hace `match` del `Either`.
   Ninguna sale como toast: el mensaje ("La clave de API no es válida", "No hay
   conexión…") habla de lo que el usuario acaba de hacer y va dentro de la hoja
   —la de escaneo, o Ajustes—, junto al botón de volver a intentarlo.

   Escanear ya no agrega movimientos: deja abierto el formulario de "Nuevo
   movimiento" lleno con el ticket, y guardar es de ahí. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { messageFor } from '../../../shared/domain/errors';
import { cleanOcrSettings } from '../../../shared/domain/ocr-settings';
import type { HiloError } from '../../../shared/domain/errors';
import { scanReceipt } from '../application/scan-receipt';
import { verifyOcrSettings } from '../application/verify-ocr-settings';

export type ReceiptOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

export type ReceiptSlice = {
  /** Manda las fotos al modelo y, si las leyó, cierra la hoja de escaneo y
   *  abre el formulario de movimiento con el ticket desglosado. */
  scanReceipt: (files: File[]) => Promise<ReceiptOutcome>;
  /** Comprueba una key y un modelo (los que están escritos en Ajustes, aún
   *  sin guardar). */
  verifyOcrSettings: (apiKey: string, model: string) => Promise<ReceiptOutcome>;
};

const toOutcome = (result: E.Either<HiloError, unknown>): ReceiptOutcome =>
  pipe(
    result,
    E.match(
      (error: HiloError): ReceiptOutcome => ({ ok: false, message: messageFor(error) }),
      (): ReceiptOutcome => ({ ok: true }),
    ),
  );

export const createReceiptSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], ReceiptSlice> =>
  (set, get) => ({
    scanReceipt: async (files) => {
      const { ocrSettings, accounts, categories } = get();
      const result = await runRTE(scanReceipt({
        files,
        apiKey: ocrSettings.apiKey,
        model: ocrSettings.model,
        accounts,
        categories,
      }), deps);
      if (E.isRight(result)) {
        set({ receiptModalOpen: false });
        get().openPrefilledSheet('expense', result.right);
      }
      return toOutcome(result);
    },

    // Se prueba lo mismo que se guardaría: la key ya limpia.
    verifyOcrSettings: async (apiKey, model) =>
      toOutcome(await runRTE(verifyOcrSettings(cleanOcrSettings({ apiKey, model })), deps)),
  });
