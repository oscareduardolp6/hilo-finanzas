/* Leer un archivo de respaldo y devolver lo que trae, SIN aplicarlo.

   Es la diferencia de fondo con `receiveSync`, que funde en cuanto entiende el
   payload: restaurar pierde a propósito lo que había, así que entre leer y
   aplicar va una confirmación. Por eso son dos pasos y dos acciones distintas
   del slice — el caso de uso solo lee. */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import type { Deps } from '../../../app/dependencies';
import { invalidPayload } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { parseExportText } from '../../sync/domain/payload';
import type { IncomingPayload } from '../../sync/domain/payload';

/* Los mensajes ya vienen en español desde el gateway y desde `parseExportText`
   ('No se pudo leer el archivo.', 'Esto no parece un export de Hilo.'), y son
   los mismos que enseñaba el `FileReader` de `BackupModal`. `messageFor`
   devuelve intacto el de `InvalidPayload`, así que llegan literales a la UI. */
export const readBackup = (file: File): RTE.ReaderTaskEither<Deps, HiloError, IncomingPayload> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      TE.tryCatch(
        () => deps.fileGateway.readText(file).then(parseExportText),
        (e) => invalidPayload(e instanceof Error ? e.message : 'No se pudo leer el archivo.'),
      ),
    ),
  );
