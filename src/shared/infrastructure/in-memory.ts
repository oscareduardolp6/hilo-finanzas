/* Contraparte en memoria de los puertos: el pago del patrón repository.

   Con esto, un caso de uso se corre en un test sin IndexedDB, sin
   `fake-indexeddb`, sin mocks de módulo y sin montar React — y además se puede
   forzar un fallo (`failWith`) para ejercitar la rama `Left` del `Either`, que
   con la implementación real es incómoda de provocar. */

import * as TE from 'fp-ts/TaskEither';
import { persistenceError } from '../domain/errors';
import type { HiloError } from '../domain/errors';
import type { OcrSettingsRepository, StateRepository, SyncStateRepository } from '../domain/ports';
import type { DataState, OcrSettings, SyncState } from '../domain/types';

export type InMemoryOptions<A> = {
  /** Contenido inicial. `null` (por defecto) = perfil nuevo. */
  initial?: A | null;
  /** Si se pasa, toda operación falla con este error. */
  failWith?: HiloError;
};

/** Un repositorio en memoria expone además `peek` para asertar lo guardado. */
export type InMemoryRepository<A, Port> = Port & {
  peek: () => A | null;
};

type Cell<A, SaveIn> = InMemoryRepository<
  A,
  {
    load: TE.TaskEither<HiloError, A | null>;
    save: (value: SaveIn) => TE.TaskEither<HiloError, void>;
  }
>;

/** Construye un repositorio `{ load, save }` sobre una celda mutable.
 *  `SaveIn` se separa de `A` porque el puerto de OCR admite guardar `null`, y
 *  `normalize` deja que cada puerto ajuste lo que termina almacenado. */
function makeRepository<A, SaveIn>(
  options: InMemoryOptions<A>,
  normalize: (value: SaveIn) => A | null,
): Cell<A, SaveIn> {
  let current: A | null = options.initial ?? null;
  const fail = options.failWith;

  return {
    load: fail ? TE.left(fail) : TE.fromIO(() => current),
    save: (value: SaveIn) =>
      fail
        ? TE.left(fail)
        : TE.fromIO(() => {
            current = normalize(value);
          }),
    peek: () => current,
  };
}

export function inMemoryStateRepository(
  options: InMemoryOptions<DataState> = {},
): InMemoryRepository<DataState, StateRepository> {
  return makeRepository<DataState, DataState>(options, (state) => state);
}

export function inMemoryOcrSettingsRepository(
  options: InMemoryOptions<OcrSettings> = {},
): InMemoryRepository<OcrSettings, OcrSettingsRepository> {
  // Igual que la implementación real: guardar una config vacía borra la entrada.
  return makeRepository<OcrSettings, OcrSettings | null>(options, (s) =>
    s && (s.apiKey || s.model) ? s : null,
  );
}

export function inMemorySyncStateRepository(
  options: InMemoryOptions<SyncState> = {},
): InMemoryRepository<SyncState, SyncStateRepository> {
  return makeRepository<SyncState, SyncState>(options, (state) => state);
}

/** Atajo para el caso más común en tests: "la persistencia está caída". */
export const brokenPersistence = (): HiloError => persistenceError(new Error('IndexedDB caído'));
