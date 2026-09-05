/* Acciones del escaneo de tickets: leer la foto y agregar lo confirmado.

   Único punto de la feature que corre una mónada y hace `match` del `Either`.
   El fallo del escaneo NO sale como toast: el mensaje ("La clave de API no es
   válida", "No hay conexión…") habla de la foto que el usuario acaba de subir y
   va dentro de la hoja, junto al botón de volver a intentarlo. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO, runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { messageFor } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { addReceiptTransactions } from '../application/add-receipt-transactions';
import { scanReceipt } from '../application/scan-receipt';
import type { ReceiptDraft } from '../domain/draft';
import type { ReceiptPayload } from '../domain/to-transactions';

export type ScanOutcome =
  | { readonly ok: true; readonly draft: ReceiptDraft }
  | { readonly ok: false; readonly message: string };

export type ReceiptSlice = {
  /** Manda la foto al modelo y devuelve el borrador, sin aplicarlo. */
  scanReceipt: (file: File) => Promise<ScanOutcome>;
  /** Agrega los movimientos del ticket ya revisado. */
  addReceiptTransactions: (payload: ReceiptPayload) => void;
};

export const createReceiptSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], ReceiptSlice> =>
  (set, get) => ({
    scanReceipt: async (file) => {
      const { ocrSettings, categories } = get();
      const result = await runRTE(scanReceipt({
        file,
        apiKey: ocrSettings.apiKey,
        model: ocrSettings.model,
        expenseCategories: categories.filter(c => c.type === 'expense'),
      }), deps);
      return pipe(
        result,
        E.match(
          (error: HiloError): ScanOutcome => ({ ok: false, message: messageFor(error) }),
          (draft): ScanOutcome => ({ ok: true, draft }),
        ),
      );
    },

    addReceiptTransactions: (payload) => {
      const { categories, transactions } = get();
      set(runRIO(addReceiptTransactions(categories, transactions, payload), deps));
    },
  });
