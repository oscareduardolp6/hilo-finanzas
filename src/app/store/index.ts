/* El store de Hilo, compuesto por slices.

   `createStore` VANILLA, no `create`: el store se construye por montaje y se
   entrega por contexto (ver `store-context.tsx`), no como singleton de módulo.
   Es deliberado y no negociable — el estado vivía en `App`, así que se
   reiniciaba en cada `render()`. Un singleton filtraría estado entre los 27
   tests de integración y rompería el que hace `cleanup()` y remonta para probar
   la rehidratación. Como efecto secundario feliz, las dependencias se inyectan
   al construirlo, que es lo que hace testeable el store. */

import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Deps } from '../dependencies';
import { createDataSlice } from './data-slice';
import type { DataSlice } from './data-slice';
import { createSettingsSlice } from './settings-slice';
import type { SettingsSlice } from './settings-slice';
import { createUiSlice } from './ui-slice';
import type { UiSlice } from './ui-slice';

export type HiloStore = DataSlice & UiSlice & SettingsSlice;

export type HiloStoreApi = ReturnType<typeof createHiloStore>;

export const createHiloStore = (deps: Deps) =>
  createStore<HiloStore>()(
    subscribeWithSelector((...args) => ({
      ...createDataSlice(deps)(...args),
      ...createUiSlice(...args),
      ...createSettingsSlice(...args),
    })),
  );

export { selectDataState } from './data-slice';
export type { DataSlice, UiSlice, SettingsSlice };
