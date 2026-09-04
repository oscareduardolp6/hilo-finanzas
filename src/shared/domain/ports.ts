/* Puertos: lo que los casos de uso necesitan del mundo exterior, expresado como
   records de FUNCIONES (no clases). Cada uno tiene al menos dos implementaciones
   — la real en `shared/infrastructure/repositories.ts` y una en memoria en
   `shared/infrastructure/in-memory.ts` — y esa es toda la razón de ser del
   patrón repository aquí: poder correr un caso de uso sin IndexedDB, sin mocks
   de módulo y sin montar React. */

import type { TaskEither } from 'fp-ts/TaskEither';
import type { HiloError } from './errors';
import type { DataState, OcrSettings, SyncState } from './types';

/** Las cinco colecciones, bajo `STORAGE_KEY`. `null` = perfil nuevo. */
export type StateRepository = {
  readonly load: TaskEither<HiloError, DataState | null>;
  readonly save: (state: DataState) => TaskEither<HiloError, void>;
};

/** Clave propia: nunca entra al blob de sync / QR / respaldo. */
export type OcrSettingsRepository = {
  readonly load: TaskEither<HiloError, OcrSettings | null>;
  /** `null` (o todo vacío) borra la entrada en vez de guardar una vacía. */
  readonly save: (settings: OcrSettings | null) => TaskEither<HiloError, void>;
};

/** Estado de sync LOCAL de este dispositivo; tampoco viaja. */
export type SyncStateRepository = {
  readonly load: TaskEither<HiloError, SyncState | null>;
  readonly save: (state: SyncState) => TaskEither<HiloError, void>;
};

/** Inyectados para que los casos de uso sean deterministas en test. */
export type Clock = () => number;
export type IdGenerator = (prefix?: string) => string;
