/* Guardar la key y el modelo del escaneo de tickets.

   Van bajo su propia clave de IndexedDB (`OCR_SETTINGS_STORAGE_KEY`), nunca
   dentro del blob que viaja en sync / QR / respaldo: por construcción, una key
   de API no puede acabar en el teléfono de al lado.

   `ReaderTaskEither` porque escribir puede fallar. Guardar la config vacía
   borra la entrada — eso lo decide el repositorio, no este caso de uso. */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import type { Deps } from '../../../app/dependencies';
import type { HiloError } from '../../../shared/domain/errors';
import type { OcrSettings } from '../../../shared/domain/types';

/* La limpieza (quitar espacios e invisibles de la key) es de `shared/domain/`:
   también la usa "Probar clave", que es de `receipt-ocr`. */
export { cleanOcrSettings } from '../../../shared/domain/ocr-settings';

export const saveOcrSettings = (
  settings: OcrSettings,
): RTE.ReaderTaskEither<Deps, HiloError, void> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) => deps.ocrSettingsRepository.save(settings)),
  );
