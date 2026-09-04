/* El guardado automático, que antes era un `useEffect` de `App`.

   Reproduce tres detalles del efecto original que es fácil perder:

   1. **No guarda mientras `!loaded`**, para no pisar los datos del usuario con
      la semilla de demo antes de haberlos leído.
   2. **Sí guarda en el instante en que `loaded` pasa a true.** El efecto
      original tenía `loaded` en su array de dependencias, así que al terminar
      la hidratación disparaba un guardado aunque no hubiera cambiado nada —
      es lo que hace que un perfil nuevo persista la semilla de demo.
      `hydrateFromRepositories` hace un solo `set`, así que aquí llega como un
      único disparo.
   3. **Un fallo se convierte en toast**, no en excepción silenciosa. */

import * as E from 'fp-ts/Either';
import { messageFor } from '../shared/domain/errors';
import { persist, persistSyncState } from './application/persist';
import type { Deps } from './dependencies';
import { runRTE } from './run';
import { selectDataState } from './store';
import type { HiloStoreApi } from './store';

/** Arranca las suscripciones de guardado. Devuelve la función para cortarlas. */
export function subscribePersistence(store: HiloStoreApi, deps: Deps): () => void {
  const unsubscribeData = store.subscribe(
    // Las 5 colecciones + `loaded`: exactamente el array de dependencias que
    // tenía el useEffect.
    (state) =>
      [
        state.accounts,
        state.categories,
        state.transactions,
        state.installmentPlans,
        state.tombstones,
        state.loaded,
      ] as const,
    async (current) => {
      const loaded = current[5];
      if (!loaded) return;
      const result = await runRTE(persist(selectDataState(store.getState())), deps);
      if (E.isLeft(result)) store.getState().setToast(messageFor(result.left));
    },
    { equalityFn: shallowArrayEqual },
  );

  const unsubscribeSync = store.subscribe(
    (state) => state.syncState,
    async (syncState) => {
      if (!syncState) return;
      // Su fallo se ignora a propósito: es estado local del dispositivo y no
      // hay nada útil que decirle al usuario. Igual que el `.catch(() => {})`.
      await runRTE(persistSyncState(syncState), deps);
    },
  );

  return () => {
    unsubscribeData();
    unsubscribeSync();
  };
}

/** Comparación por identidad elemento a elemento: replica cómo React compara
 *  un array de dependencias. */
function shallowArrayEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => Object.is(value, b[i]));
}
