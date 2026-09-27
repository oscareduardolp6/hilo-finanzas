/* El guardado automático, que antes era un `useEffect` de `App`.

   Dos detalles a propósito:

   1. **No guarda mientras `!loaded`**, para no pisar los datos del usuario con
      la semilla de demo antes de haberlos leído.
   2. **NO guarda solo porque `loaded` pase a true.** Antes sí lo hacía (así
      persistía la semilla de demo en un perfil nuevo, sobre IndexedDB) — pero
      con Firestore como fuente compartida entre dispositivos, ese disparo es
      peligroso: si este dispositivo hidrata con Firestore vacío (perfil
      nuevo, o simplemente porque el guardado de OTRO dispositivo — por
      ejemplo, un restore de respaldo — todavía no había llegado), autoguardar
      la semilla de demo pisa ese dato real. `loaded` deliberadamente NO está
      en el array que vigila `subscribe`: si Firestore vino vacío, las 6
      colecciones se quedan en sus mismas referencias de siempre (el `set` de
      `hydrateFromRepositories` no las toca), así que no hay "cambio" que
      dispare un guardado — la demo se ve en pantalla pero no se escribe a
      Firestore hasta el primer cambio real del usuario (o hasta que
      `migrateToFirestore` suba algo, que se guarda aparte, sin pasar por esta
      suscripción).
   3. **Un fallo se convierte en toast**, no en excepción silenciosa. */

import * as E from 'fp-ts/Either';
import { messageFor } from '../shared/domain/errors';
import { persist, persistHideBalances } from './application/persist';
import type { Deps } from './dependencies';
import { runRTE } from './run';
import { selectDataState } from './store';
import type { HiloStoreApi } from './store';

/** Arranca las suscripciones de guardado. Devuelve la función para cortarlas. */
export function subscribePersistence(store: HiloStoreApi, deps: Deps): () => void {
  const unsubscribeData = store.subscribe(
    // Las 6 colecciones, a propósito SIN `loaded` — ver el comentario de arriba.
    (state) =>
      [
        state.accounts,
        state.categories,
        state.transactions,
        state.installmentPlans,
        state.tombstones,
        state.benefitPrograms,
      ] as const,
    async () => {
      if (!store.getState().loaded) return;
      const result = await runRTE(persist(selectDataState(store.getState())), deps);
      if (E.isLeft(result)) {
        // El toast es un texto fijo (contrato de test, ver errors.ts); la causa
        // real de un PersistenceError solo se ve aquí, en la consola.
        // eslint-disable-next-line no-console
        console.error('Fallo al guardar en Firestore:', result.left);
        store.getState().setToast(messageFor(result.left));
      }
    },
    { equalityFn: shallowArrayEqual },
  );

  const unsubscribeHideBalances = store.subscribe(
    (state) => state.hideBalances,
    async (hideBalances) => {
      // Estado local del dispositivo: su fallo se ignora, no hay nada útil
      // que decirle al usuario.
      await runRTE(persistHideBalances(hideBalances), deps);
    },
  );

  return () => {
    unsubscribeData();
    unsubscribeHideBalances();
  };
}

/** Comparación por identidad elemento a elemento: replica cómo React compara
 *  un array de dependencias. */
function shallowArrayEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => Object.is(value, b[i]));
}
