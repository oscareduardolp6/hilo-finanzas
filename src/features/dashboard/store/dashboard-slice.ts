/* La única acción propia de Inicio. No hay caso de uso porque no hay dominio
   que ejecutar: es navegación, estado efímero puro.

   Los campos que escribe son del historial, pero la acción es del dashboard —
   describe lo que pasa al tocar una porción de la dona. Va en un solo `set`
   para que sea una sola notificación del store, como lo era un solo render de
   React cuando eran cuatro `setState` en el mismo handler. */

import type { StateCreator } from 'zustand';
import type { HiloStore } from '../../../app/store';

export type DashboardSlice = {
  /** Salta al historial filtrado por esa categoría, en el mes en curso. */
  showCategoryInHistory: (categoryId: string) => void;
};

export const createDashboardSlice: StateCreator<HiloStore, [], [], DashboardSlice> = (set) => ({
  showCategoryInHistory: (categoryId) =>
    set({
      filterCategory: categoryId,
      filterType: 'all',
      showAllTime: false,
      activeTab: 'history',
    }),
});
