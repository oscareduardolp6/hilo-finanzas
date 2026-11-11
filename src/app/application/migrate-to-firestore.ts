/* Caso de uso: sembrar Firestore con el snapshot local, una vez por
   dispositivo al iniciar sesión.

   El usuario confirmó que su teléfono es la fuente de la verdad y que no le
   importa perder lo que solo exista en otro dispositivo — así que la regla es
   deliberadamente simple: si Firestore YA tiene datos (de este dispositivo o
   de cualquier otro que haya iniciado sesión antes), no se toca; si está
   vacío y este dispositivo tiene un snapshot local, se sube. Sin merge. Ver
   "Migración de datos existentes" en agents/plans/backend-sync.md.

   **"Vacío" significa que la lectura funcionó y no había documento** — no
   que la lectura falló. Antes las dos cosas se confundían (`getOrElse(null)`)
   y eso borró datos reales en producción (noviembre de 2026): un arranque con
   mala señal no pudo leer Firestore, lo tomó por vacío y subió encima el
   snapshot local de este dispositivo, congelado desde el día de la migración
   (septiembre). Si no se puede leer el remoto, no se sabe nada de él, y lo
   único seguro es no escribir.

   Es un `ReaderTask`, no un `ReaderTaskEither`, por la misma razón que
   `hydrate`: un fallo aquí no debe impedir que la app arranque. Se llama
   desde `hydrateFromRepositories` (data-slice.ts), justo antes de `hydrate`
   — es la otra excepción documentada a "solo un slice llama runR*", por la
   misma razón que ya aplica a la hidratación: corre antes de que el store
   termine de armarse. */

import * as E from 'fp-ts/Either';
import * as RT from 'fp-ts/ReaderTask';
import type { Deps } from '../dependencies';

export const migrateToFirestore: RT.ReaderTask<Deps, void> = (deps) => async () => {
  const remote = await deps.stateRepository.load();
  // Lectura fallida: no sabemos si Firestore tiene datos, así que no se toca.
  if (E.isLeft(remote)) return;
  // Firestore ya tiene datos: gana la nube, no se toca.
  if (remote.right !== null) return;

  const local = await deps.legacyLocalStateRepository.load();
  if (E.isLeft(local) || local.right === null) return; // nada local que subir.

  await deps.stateRepository.save(local.right)();
};
