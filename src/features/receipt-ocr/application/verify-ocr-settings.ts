/* "Probar clave", en Ajustes: comprobar la key y el modelo antes de gastar un
   escaneo. Existe porque la key vive por dispositivo y, pegada en el teléfono
   dentro de un campo enmascarado, un error al copiarla solo aparecía al
   escanear, como "La clave de API no es válida". */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import type { Deps } from '../../../app/dependencies';
import { receiptApiError } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import type { VerifyKeyRequest } from '../domain/ports';

export const verifyOcrSettings = (
  request: VerifyKeyRequest,
): RTE.ReaderTaskEither<Deps, HiloError, void> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      TE.tryCatch(
        () => deps.receiptGateway.verify(request),
        (e) => receiptApiError(0, e instanceof Error ? e.message : 'No se pudo comprobar la clave.'),
      ),
    ),
  );
