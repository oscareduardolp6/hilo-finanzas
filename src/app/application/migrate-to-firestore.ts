/* Caso de uso: sembrar Firestore con el snapshot local, una vez por
   dispositivo al iniciar sesión.

   El usuario confirmó que su teléfono es la fuente de la verdad y que no le
   importa perder lo que solo exista en otro dispositivo — así que la regla es
   deliberadamente simple: si Firestore YA tiene datos (de este dispositivo o
   de cualquier otro que haya iniciado sesión antes), no se toca; si está
   vacío y este dispositivo tiene un snapshot local, se sube. Sin merge. Ver
   "Migración de datos existentes" en agents/plans/backend-sync.md.

   Es un `ReaderTask`, no un `ReaderTaskEither`, por la misma razón que
   `hydrate`: un fallo aquí no debe impedir que la app arranque (en el peor
   caso, arranca con Firestore vacío y la próxima escritura ya migra). Se
   llama desde `hydrateFromRepositories` (data-slice.ts), justo antes de
   `hydrate` — es la otra excepción documentada a "solo un slice llama
   runR*", por la misma razón que ya aplica a la hidratación: corre antes de
   que el store termine de armarse. */

import { pipe } from 'fp-ts/function';
import * as RT from 'fp-ts/ReaderTask';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import type { DataState } from '../../shared/domain/types';
import type { Deps } from '../dependencies';

const loadOrNull = (load: TE.TaskEither<unknown, DataState | null>): T.Task<DataState | null> =>
  pipe(
    load,
    TE.getOrElse(() => T.of<DataState | null>(null)),
  );

export const migrateToFirestore: RT.ReaderTask<Deps, void> = (deps) => async () => {
  const remote = await loadOrNull(deps.stateRepository.load)();
  if (remote !== null) return; // Firestore ya tiene datos: gana la nube, no se toca.

  const local = await loadOrNull(deps.legacyLocalStateRepository.load)();
  if (local === null) return; // nada local que subir.

  await deps.stateRepository.save(local)();
};
