/* Punto de entrada de los tests de UI por feature.

   Monta UN container dentro de un `HiloStoreProvider` con dependencias en
   memoria — nunca `<App/>`. Eso es lo que los vuelve atómicos de su feature:
   no arrastran el donut, ni los 10 modales, ni la navegación, y cuando fallan
   señalan a la feature y no "a la app".

   Es infraestructura de test, no de producción: por eso vive en `src/test/` y
   no en `shared/`. */

import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createDeps } from '../app/dependencies';
import type { Deps } from '../app/dependencies';
import { HiloStoreProvider } from '../app/store-context';
import { createHiloStore } from '../app/store';
import type { HiloStoreApi } from '../app/store';
import {
  inMemoryOcrSettingsRepository,
  inMemoryStateRepository,
  inMemorySyncStateRepository,
} from '../shared/infrastructure/in-memory';
import type { DataState } from '../shared/domain/types';

/** Reloj fijo: cualquier `createdAt`/`updatedAt` que escriba un caso de uso
 *  durante el test es comparable con `toEqual`. */
export const AHORA = 1_700_000_000_000;

export type RenderFeatureOptions = {
  /** Estado inicial "en IndexedDB". Lo que no se pase va vacío. */
  state?: Partial<DataState>;
  /** Para sobreescribir el reloj, los ids o un repositorio concreto. */
  deps?: Partial<Deps>;
};

export type RenderFeatureResult = {
  user: ReturnType<typeof userEvent.setup>;
  store: HiloStoreApi;
  deps: Deps;
  /** Para las pocas aserciones que solo pueden hacerse por selector CSS, como
   *  distinguir la rejilla de escritorio de la lista de móvil. */
  container: HTMLElement;
};

/** Monta `ui` con el store ya hidratado desde repositorios en memoria. */
export async function renderFeature(
  ui: ReactElement,
  options: RenderFeatureOptions = {},
): Promise<RenderFeatureResult> {
  const deps = createDeps({
    stateRepository: inMemoryStateRepository({
      initial: {
        accounts: [],
        categories: [],
        transactions: [],
        installmentPlans: [],
        tombstones: [],
        benefitPrograms: [],
        ...options.state,
      },
    }),
    ocrSettingsRepository: inMemoryOcrSettingsRepository(),
    syncStateRepository: inMemorySyncStateRepository(),
    clock: () => AHORA,
    // El prefijo es opcional en el puerto (`uid()` se llama sin él en algún
    // sitio), así que el doble aquí también tiene que admitir no recibirlo.
    idGenerator: (prefix?: string) => `${prefix ?? 'id'}_nuevo`,
    ...options.deps,
  });

  const store = createHiloStore(deps);
  const user = userEvent.setup();

  const { container } = render(
    <HiloStoreProvider deps={deps} store={store}>
      {ui}
    </HiloStoreProvider>,
  );

  // El Provider hidrata en un efecto; sin esperar, el primer assert correría
  // contra la semilla de demo en vez de contra el estado del test.
  await waitFor(() => {
    if (!store.getState().loaded) throw new Error('todavía hidratando');
  });

  return { user, store, deps, container };
}
