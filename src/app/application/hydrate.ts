/* Caso de uso: cargar lo persistido al arrancar.

   Es un `ReaderTask`, NO un `ReaderTaskEither`, y eso es deliberado: la
   hidratación **no puede fallar** desde el punto de vista del usuario. Si
   IndexedDB no responde, la app arranca con los datos de ejemplo y no se
   muestra ningún error — es el comportamiento que ya tenía el `useEffect` de
   `App`, que se tragaba la excepción a propósito.

   Cada lectura se recupera por separado, con su propio fallback, porque cada
   una significa algo distinto cuando falta:
     - estado      → `null`, y el store conserva la semilla de demo
     - config OCR  → `null`, y queda la config vacía
     - sync state  → `makeSyncState()`, un dispositivo recién bautizado */

import { sequenceS } from 'fp-ts/Apply';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { makeSyncState } from '../../shared/infrastructure/indexed-db';
import type { HiloError } from '../../shared/domain/errors';
import type { DataState, OcrSettings, SyncState } from '../../shared/domain/types';
import type { Deps } from '../dependencies';

export type HydratedState = {
  /** `null` = perfil nuevo: el store se queda con los datos de ejemplo. */
  data: DataState | null;
  ocrSettings: OcrSettings | null;
  /** Siempre presente: si no había, se bautiza uno nuevo. */
  syncState: SyncState;
};

/** Lee un puerto y absorbe su error con un valor por defecto. */
const readOr =
  <A>(select: (deps: Deps) => TE.TaskEither<HiloError, A>, fallback: A): RT.ReaderTask<Deps, A> =>
  (deps) =>
    pipe(
      select(deps),
      TE.getOrElse(() => T.of(fallback)),
    );

export const hydrate: RT.ReaderTask<Deps, HydratedState> = pipe(
  // ApplyPar: las tres lecturas van en paralelo, como los tres `.then` sueltos
  // del efecto original.
  sequenceS(RT.ApplyPar)({
    data: readOr<DataState | null>((d) => d.stateRepository.load, null),
    ocrSettings: readOr<OcrSettings | null>((d) => d.ocrSettingsRepository.load, null),
    storedSync: readOr<SyncState | null>((d) => d.syncStateRepository.load, null),
  }),
  RT.chain(({ data, ocrSettings, storedSync }) => (deps: Deps) => async (): Promise<HydratedState> => ({
    data,
    ocrSettings,
    // Un sync state escrito por una versión vieja puede no traer `peers`.
    // (El original lo escribía como `{ peers: {}, ...s }`; explícito se lee
    // mejor y no depende del orden del spread.)
    syncState:
      storedSync && storedSync.deviceId
        ? { ...storedSync, peers: storedSync.peers ?? {} }
        : makeSyncState(deps.idGenerator),
  })),
);
