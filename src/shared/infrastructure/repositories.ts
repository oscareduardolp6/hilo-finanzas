/* Implementación real de los puertos: envuelve las Promises de `indexed-db.ts`
   en `TaskEither<HiloError, _>`.

   El envoltorio es delgado a propósito. Las funciones de abajo siguen siendo la
   API pública histórica (los tests las importan tal cual por el barrel); esto
   solo les pone el canal de error tipado que los casos de uso necesitan. */

import * as TE from 'fp-ts/TaskEither';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { persistenceError } from '../domain/errors';
import type { HideBalancesRepository, OcrSettingsRepository, StateRepository } from '../domain/ports';
import type { DataState, OcrSettings } from '../domain/types';
import { auth, db } from './firebase';
import { loadHideBalances, loadOcrSettings, loadState, saveHideBalances, saveOcrSettings, saveState } from './indexed-db';

/** Toda excepción entra al canal de error como `PersistenceError`. */
const attempt = <A>(thunk: () => Promise<A>) => TE.tryCatch(thunk, persistenceError);

/** El snapshot histórico de este dispositivo, previo a Firestore. `Deps`
 *  ya no lo usa como `stateRepository` — solo lo lee `migrate-to-firestore.ts`
 *  una vez por dispositivo al iniciar sesión, vía `Deps.legacyLocalStateRepository`
 *  (`save` se conserva por si algo lo necesita, pero nada en producción ya
 *  escribe aquí desde que `firestoreStateRepository` es la fuente de verdad). */
export const indexedDbStateRepository: StateRepository = {
  load: attempt<DataState | null>(() => loadState()),
  save: (state) => attempt<void>(() => saveState(state)),
};

/** Un documento por usuario (`users/{uid}`) con el blob completo — mismo
 *  shape que `loadState`/`saveState` ya usaban contra IndexedDB, solo cambia
 *  el destino. El `uid` se resuelve en cada llamada vía `auth.currentUser`,
 *  no se fija al construir el repositorio (ver `firestore.rules`: sin sesión
 *  no hay lectura/escritura posible de todas formas). */
export const firestoreStateRepository: StateRepository = {
  load: attempt<DataState | null>(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db(), 'users', uid));
    return snap.exists() ? (snap.data() as DataState) : null;
  }),
  save: (state) =>
    attempt<void>(async () => {
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('No hay sesión activa.');
      await setDoc(doc(db(), 'users', uid), state);
    }),
};

export const indexedDbOcrSettingsRepository: OcrSettingsRepository = {
  load: attempt<OcrSettings | null>(() => loadOcrSettings()),
  save: (settings) => attempt<void>(() => saveOcrSettings(settings)),
};

export const indexedDbHideBalancesRepository: HideBalancesRepository = {
  load: attempt<boolean | null>(() => loadHideBalances()),
  save: (value) => attempt<void>(() => saveHideBalances(value)),
};
