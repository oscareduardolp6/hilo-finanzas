/* Caso de uso: cargar lo persistido al arrancar.

   Es un `ReaderTask`, NO un `ReaderTaskEither`, y eso es deliberado: la
   hidratación **no puede fallar** desde el punto de vista del usuario. Si
   Firestore no responde, la app arranca con los datos de ejemplo y no se
   muestra ningún error — es el comportamiento que ya tenía el `useEffect` de
   `App`, que se tragaba la excepción a propósito.

   Cada lectura se recupera por separado, con su propio fallback, porque cada
   una significa algo distinto cuando falta:
     - estado        → `null`, y el store conserva la semilla de demo — pero
                       además sale `dataLoadFailed: true`, para que el store
                       NO guarde nada encima (ver `persistence.ts`): una
                       lectura fallida no es un perfil nuevo, y autoguardar la
                       demo pisaría los datos reales del usuario en Firestore
     - config OCR    → `null`, y queda la config vacía
     - modo privado  → `false`, los saldos se ven por defecto */

import { sequenceS } from 'fp-ts/Apply';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { HiloError } from '../../shared/domain/errors';
import type { DataState, OcrSettings } from '../../shared/domain/types';
import type { Deps } from '../dependencies';

export type HydratedState = {
  /** `null` = perfil nuevo (o lectura fallida): el store se queda con los
   *  datos de ejemplo. */
  data: DataState | null;
  /** `true` si leer el estado FALLÓ (no es lo mismo que "no había nada"). */
  dataLoadFailed: boolean;
  ocrSettings: OcrSettings | null;
  /** Siempre presente: si no había, se asume `false` (saldos visibles). */
  hideBalances: boolean;
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
  // ApplyPar: las lecturas van en paralelo, como los `.then` sueltos del
  // efecto original.
  sequenceS(RT.ApplyPar)({
    data: (deps: Deps) =>
      pipe(
        deps.stateRepository.load,
        TE.match<HiloError, { data: DataState | null; failed: boolean }, DataState | null>(
          () => ({ data: null, failed: true }),
          (data) => ({ data, failed: false }),
        ),
      ),
    ocrSettings: readOr<OcrSettings | null>((d) => d.ocrSettingsRepository.load, null),
    hideBalances: readOr<boolean | null>((d) => d.hideBalancesRepository.load, null),
  }),
  RT.map(({ data, ocrSettings, hideBalances }) => ({
    data: data.data,
    dataLoadFailed: data.failed,
    ocrSettings,
    hideBalances: hideBalances ?? false,
  })),
);
