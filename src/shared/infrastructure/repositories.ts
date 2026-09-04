/* Implementación real de los puertos: envuelve las Promises de `indexed-db.ts`
   en `TaskEither<HiloError, _>`.

   El envoltorio es delgado a propósito. Las funciones de abajo siguen siendo la
   API pública histórica (los tests las importan tal cual por el barrel); esto
   solo les pone el canal de error tipado que los casos de uso necesitan. */

import * as TE from 'fp-ts/TaskEither';
import { persistenceError } from '../domain/errors';
import type {
  OcrSettingsRepository,
  StateRepository,
  SyncStateRepository,
} from '../domain/ports';
import type { DataState, OcrSettings, SyncState } from '../domain/types';
import {
  loadOcrSettings,
  loadState,
  loadSyncState,
  saveOcrSettings,
  saveState,
  saveSyncState,
} from './indexed-db';

/** Toda excepción de IndexedDB entra al canal de error como `PersistenceError`. */
const attempt = <A>(thunk: () => Promise<A>) => TE.tryCatch(thunk, persistenceError);

export const indexedDbStateRepository: StateRepository = {
  load: attempt<DataState | null>(() => loadState()),
  save: (state) => attempt<void>(() => saveState(state)),
};

export const indexedDbOcrSettingsRepository: OcrSettingsRepository = {
  load: attempt<OcrSettings | null>(() => loadOcrSettings()),
  save: (settings) => attempt<void>(() => saveOcrSettings(settings)),
};

export const indexedDbSyncStateRepository: SyncStateRepository = {
  load: attempt<SyncState | null>(() => loadSyncState()),
  save: (state) => attempt<void>(() => saveSyncState(state)),
};
