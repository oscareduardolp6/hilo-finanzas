/* Vocabulario funcional de Hilo: un único punto por el que entra fp-ts.
   Ver agents/plans/layered-architecture.md §2 y §3.

   Los casos de uso se ESCRIBEN aquí arriba (devuelven un valor que describe el
   efecto) y se CORREN abajo, en el slice de zustand. Estos `run*` son la
   frontera: genéricos sobre el entorno `R` para que `shared/` no dependa de
   `Deps`, que es un tipo de la capa `app`. Las versiones ya ligadas a `Deps` y
   `HiloError` viven en `src/app/run.ts`. */

export { pipe, flow, identity, constant } from 'fp-ts/function';

export * as R from 'fp-ts/Reader';
export * as RIO from 'fp-ts/ReaderIO';
export * as RT from 'fp-ts/ReaderTask';
export * as RTE from 'fp-ts/ReaderTaskEither';
export * as IO from 'fp-ts/IO';
export * as T from 'fp-ts/Task';
export * as TE from 'fp-ts/TaskEither';
export * as E from 'fp-ts/Either';
export * as O from 'fp-ts/Option';
export * as A from 'fp-ts/Array';

import type { Reader } from 'fp-ts/Reader';
import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { ReaderTask } from 'fp-ts/ReaderTask';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import type { Either } from 'fp-ts/Either';

/** Aplica las dependencias a un caso de uso determinista. */
export const runReader = <R, A>(reader: Reader<R, A>, deps: R): A => reader(deps);

/** Aplica las dependencias y ejecuta el efecto síncrono (ids, reloj). */
export const runReaderIO = <R, A>(rio: ReaderIO<R, A>, deps: R): A => rio(deps)();

/** Aplica las dependencias y ejecuta el efecto asíncrono infalible. */
export const runReaderTask = <R, A>(rt: ReaderTask<R, A>, deps: R): Promise<A> => rt(deps)();

/** Aplica las dependencias y ejecuta el efecto asíncrono falible. */
export const runReaderTaskEither = <R, E, A>(
  rte: ReaderTaskEither<R, E, A>,
  deps: R,
): Promise<Either<E, A>> => rte(deps)();
