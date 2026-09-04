/* La frontera entre fp-ts y React: los runners ya ligados a `Deps` y `HiloError`.

   REGLA DE ARQUITECTURA (agents/plans/layered-architecture.md §3): estas dos
   funciones solo pueden llamarse desde un slice de zustand. Un caso de uso es un
   valor puro hasta que alguien lo corre; si un componente lo corriera, tendríamos
   dos modelos de efectos compitiendo en vez de uno. Ningún componente — ni de
   renderizado ni de lógica — debe importar este módulo. */

import { runReader, runReaderIO, runReaderTaskEither } from '../shared/fp';
import type { Reader } from 'fp-ts/Reader';
import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import type { Either } from 'fp-ts/Either';
import type { HiloError } from '../shared/domain/errors';
import type { Deps } from './dependencies';

/** Caso de uso determinista. */
export const runR = <A>(reader: Reader<Deps, A>, deps: Deps): A => runReader(reader, deps);

/** Caso de uso síncrono con efecto (ids, reloj). */
export const runRIO = <A>(rio: ReaderIO<Deps, A>, deps: Deps): A => runReaderIO(rio, deps);

/** Caso de uso asíncrono y falible: el `Either` se resuelve en el slice. */
export const runRTE = <A>(
  rte: ReaderTaskEither<Deps, HiloError, A>,
  deps: Deps,
): Promise<Either<HiloError, A>> => runReaderTaskEither(rte, deps);
