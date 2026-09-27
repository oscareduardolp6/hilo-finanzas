/* Caso de uso: guardar el blob completo de las 6 colecciones.

   Este SÍ es un `ReaderTaskEither`: cuando falla, el usuario tiene que
   enterarse. El slice hace el `match` y convierte el `Left` en el toast
   'No se pudo guardar el cambio localmente'. */

import * as RTE from 'fp-ts/ReaderTaskEither';
import { pipe } from 'fp-ts/function';
import type { HiloError } from '../../shared/domain/errors';
import type { DataState } from '../../shared/domain/types';
import type { Deps } from '../dependencies';

export const persist = (state: DataState): RTE.ReaderTaskEither<Deps, HiloError, void> =>
  pipe(
    RTE.ask<Deps, HiloError>(),
    RTE.chainTaskEitherK((deps) => deps.stateRepository.save(state)),
  );

/** El modo privado es local del dispositivo: su
 *  fallo se ignora, no hay nada útil que decirle al usuario. */
export const persistHideBalances = (
  hideBalances: boolean,
): RTE.ReaderTaskEither<Deps, HiloError, void> =>
  pipe(
    RTE.ask<Deps, HiloError>(),
    RTE.chainTaskEitherK((deps) => deps.hideBalancesRepository.save(hideBalances)),
  );
