/* Escanear la foto: prepararla, mandarla al modelo y devolver el borrador que
   la hoja edita. Como en `backup` y `monefy-import`, leer no aplica nada.

   `ReaderTaskEither` porque es lo más falible de la app: no hay red, la key no
   sirve, se acabó la cuota, o la foto no se entiende. Los mensajes vienen ya en
   español desde el gateway y `messageFor` los pasa intactos. */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import type { Deps } from '../../../app/dependencies';
import { receiptApiError } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { isoFromEpoch } from '../../../shared/domain/dates';
import type { Category } from '../../../shared/domain/types';
import { buildReceiptDraft } from '../domain/draft';
import type { ReceiptDraft } from '../domain/draft';

export type ScanInput = {
  file: File;
  apiKey: string;
  model: string;
  expenseCategories: Category[];
};

export const scanReceipt = (
  { file, apiKey, model, expenseCategories }: ScanInput,
): RTE.ReaderTaskEither<Deps, HiloError, ReceiptDraft> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      TE.tryCatch(
        async () => {
          const image = await deps.receiptGateway.prepare(file);
          const scan = await deps.receiptGateway.scan({ apiKey, model, image, expenseCategories });
          return buildReceiptDraft(scan, {
            expenseCategories,
            newId: deps.idGenerator,
            // `isoFromEpoch` y no `toISOString`: la fecha del ticket es la
            // local del usuario, como en todo el resto de la app.
            today: isoFromEpoch(deps.clock()),
          });
        },
        // El status no lo sabe este nivel: lo que importa es el texto, que ya
        // viene redactado para el usuario. Cero es "no fue un código HTTP".
        (e) => receiptApiError(0, e instanceof Error ? e.message : 'No se pudo leer el ticket.'),
      ),
    ),
  );
