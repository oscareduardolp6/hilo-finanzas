/* El store se crea POR MONTAJE y se entrega por contexto.

   Ver la nota en `store/index.ts`: un singleton de módulo filtraría estado
   entre tests y rompería la rehidratación. Con un store por Provider, cada
   `render(<App/>)` arranca limpio, igual que cuando el estado vivía en `App`. */

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { productionDeps } from './dependencies';
import type { Deps } from './dependencies';
import { subscribePersistence } from './persistence';
import { createHiloStore } from './store';
import type { HiloStore, HiloStoreApi } from './store';

const HiloStoreContext = createContext<HiloStoreApi | null>(null);

export type HiloStoreProviderProps = {
  children: ReactNode;
  /** Inyectar dependencias en test; en producción son las reales. */
  deps?: Deps;
  /** Permite a un test partir de un store ya construido. */
  store?: HiloStoreApi;
};

export function HiloStoreProvider({ children, deps = productionDeps, store }: HiloStoreProviderProps) {
  const [ownStore] = useState(() => store ?? createHiloStore(deps));

  useEffect(() => {
    const unsubscribe = subscribePersistence(ownStore, deps);
    // La hidratación se lanza DESPUÉS de suscribir para que su `set` final
    // (el que pone `loaded: true`) dispare el primer guardado, como hacía el
    // efecto original.
    void ownStore.getState().hydrateFromRepositories();
    return unsubscribe;
  }, [ownStore, deps]);

  return <HiloStoreContext.Provider value={ownStore}>{children}</HiloStoreContext.Provider>;
}

/** El store crudo: para suscripciones y para leerlo fuera de render. */
export function useHiloStoreApi(): HiloStoreApi {
  const store = useContext(HiloStoreContext);
  if (!store) throw new Error('useHiloStoreApi debe usarse dentro de <HiloStoreProvider>');
  return store;
}

/** Suscripción con selector. Sin selector devuelve el store entero y
 *  re-renderiza ante cualquier cambio — que es justo lo que hacía `App`
 *  cuando era dueña de los 29 `useState`. */
export function useHiloStore(): HiloStore;
export function useHiloStore<A>(selector: (state: HiloStore) => A): A;
export function useHiloStore<A>(selector?: (state: HiloStore) => A) {
  const store = useHiloStoreApi();
  return useStore(store, selector ?? ((state) => state as unknown as A));
}
