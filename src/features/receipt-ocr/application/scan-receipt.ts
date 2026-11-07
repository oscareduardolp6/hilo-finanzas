/* Escanear el ticket: preparar sus fotos, mandarlas juntas al modelo y
   devolver el borrador del formulario de movimiento ya lleno. Como en `backup`
   y `monefy-import`, leer no aplica nada: guardar es del formulario.

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
import type { Account, Category } from '../../../shared/domain/types';
import type { TransactionFormDraft } from '../../transactions/domain/form';
import { buildReceiptDraft } from '../domain/draft';
import { receiptToFormDraft } from '../domain/to-form';

export type ScanInput = {
  /** Las fotos en orden, de arriba hacia abajo del ticket. */
  files: File[];
  apiKey: string;
  model: string;
  accounts: Account[];
  categories: Category[];
};

export const scanReceipt = (
  { files, apiKey, model, accounts, categories }: ScanInput,
): RTE.ReaderTaskEither<Deps, HiloError, TransactionFormDraft> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      TE.tryCatch(
        async () => {
          const expenseCategories = categories.filter(c => c.type === 'expense');
          // En orden y una por una: en un teléfono, decodificar varias fotos de
          // 12 MP a la vez en `<canvas>` es lo que se queda sin memoria.
          const images = [];
          for (const file of files) images.push(await deps.receiptGateway.prepare(file));
          const scan = await deps.receiptGateway.scan({ apiKey, model, images, expenseCategories });
          const draft = buildReceiptDraft(scan, {
            expenseCategories,
            newId: deps.idGenerator,
            // `isoFromEpoch` y no `toISOString`: la fecha del ticket es la
            // local del usuario, como en todo el resto de la app.
            today: isoFromEpoch(deps.clock()),
          });
          return receiptToFormDraft(draft, { accounts, categories, newId: deps.idGenerator });
        },
        // El status no lo sabe este nivel: lo que importa es el texto, que ya
        // viene redactado para el usuario. Cero es "no fue un código HTTP".
        (e) => receiptApiError(0, e instanceof Error ? e.message : 'No se pudo leer el ticket.'),
      ),
    ),
  );
