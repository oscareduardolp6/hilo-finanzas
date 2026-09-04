/* Caso de uso: guardar el blob completo de las 5 colecciones.

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

/** El estado de sync es local del dispositivo y su fallo se ignora, igual que
 *  en el `useEffect` original (`.catch(() => {})`). */
export const persistSyncState = (
  syncState: Parameters<Deps['syncStateRepository']['save']>[0],
): RTE.ReaderTaskEither<Deps, HiloError, void> =>
  pipe(
    RTE.ask<Deps, HiloError>(),
    RTE.chainTaskEitherK((deps) => deps.syncStateRepository.save(syncState)),
  );
