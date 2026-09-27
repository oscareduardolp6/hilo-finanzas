/* Implementación real de los puertos: envuelve las Promises de `indexed-db.ts`
   en `TaskEither<HiloError, _>`.

   El envoltorio es delgado a propósito. Las funciones de abajo siguen siendo la
   API pública histórica (los tests las importan tal cual por el barrel); esto
   solo les pone el canal de error tipado que los casos de uso necesitan. */

import * as TE from 'fp-ts/TaskEither';
import { Bytes, doc, getDoc, setDoc } from 'firebase/firestore';
import { persistenceError } from '../domain/errors';
import type { HideBalancesRepository, OcrSettingsRepository, StateRepository } from '../domain/ports';
import type { DataState, OcrSettings } from '../domain/types';
import { gunzipBytes, gzipString } from './compression';
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

/** Un documento por usuario (`users/{uid}`), comprimido con gzip en un solo
 *  campo `blob` — no el objeto `DataState` plano. Firestore tiene un límite
 *  de 1 MiB por documento; un historial real de años (o con líneas de
 *  recibo OCR) lo rebasa fácil sin comprimir — pasó en producción con el
 *  primer restore de respaldo real (2.98 MB). JSON comprime muy bien (nombres
 *  de campo repetidos en cada registro), así que gzip da margen de sobra sin
 *  tocar el puerto `StateRepository` ni migrar a subcolecciones (la otra
 *  opción que consideraba `tasks/backend-sync.md`, mucho más trabajo).
 *  `gzipString`/`gunzipBytes` ya existían para el respaldo manual — se
 *  reusan tal cual. `load` todavía sabe leer el shape viejo (el objeto
 *  plano, sin `blob`) por si quedó algún documento escrito antes de este
 *  cambio. El `uid` se resuelve en cada llamada vía `auth.currentUser`, no se
 *  fija al construir el repositorio (ver `firestore.rules`: sin sesión no hay
 *  lectura/escritura posible de todas formas). */
export const firestoreStateRepository: StateRepository = {
  load: attempt<DataState | null>(async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return null;
    const snap = await getDoc(doc(db(), 'users', uid));
    if (!snap.exists()) return null;
    const raw = snap.data();
    if (raw.blob instanceof Bytes) {
      const json = await gunzipBytes(raw.blob.toUint8Array());
      return JSON.parse(json) as DataState;
    }
    // Documento del formato viejo (sin comprimir), de antes de este cambio.
    return raw as DataState;
  }),
  save: (state) =>
    attempt<void>(async () => {
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('No hay sesión activa.');
      const compressed = await gzipString(JSON.stringify(state));
      await setDoc(doc(db(), 'users', uid), { blob: Bytes.fromUint8Array(compressed) });
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
