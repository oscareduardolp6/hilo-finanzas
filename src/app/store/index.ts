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
import { createAccountsSlice } from '../../features/accounts/store/accounts-slice';
import type { AccountsSlice } from '../../features/accounts/store/accounts-slice';
import { createCategoriesSlice } from '../../features/categories/store/categories-slice';
import type { CategoriesSlice } from '../../features/categories/store/categories-slice';
import { createDashboardSlice } from '../../features/dashboard/store/dashboard-slice';
import type { DashboardSlice } from '../../features/dashboard/store/dashboard-slice';
import { createInstallmentsSlice } from '../../features/installments/store/installments-slice';
import type { InstallmentsSlice } from '../../features/installments/store/installments-slice';
import { createTransactionsSlice } from '../../features/transactions/store/transactions-slice';
import type { TransactionsSlice } from '../../features/transactions/store/transactions-slice';
import type { Deps } from '../dependencies';
import { createDataSlice } from './data-slice';
import type { DataSlice } from './data-slice';
import { createSettingsSlice } from './settings-slice';
import type { SettingsSlice } from './settings-slice';
import { createUiSlice } from './ui-slice';
import type { UiSlice } from './ui-slice';

/* Las slices de `app/store/` aportan CAMPOS, agrupados por ciclo de vida
   (persistido / efímero / config). Las de `features/<f>/store/` aportan solo
   ACCIONES sobre esos campos — así una feature se migra sin mover estado. */
export type HiloStore = DataSlice &
  UiSlice &
  SettingsSlice &
  AccountsSlice &
  TransactionsSlice &
  CategoriesSlice &
  InstallmentsSlice &
  DashboardSlice;

export type HiloStoreApi = ReturnType<typeof createHiloStore>;

export const createHiloStore = (deps: Deps) =>
  createStore<HiloStore>()(
    subscribeWithSelector((...args) => ({
      ...createDataSlice(deps)(...args),
      ...createUiSlice(...args),
      ...createSettingsSlice(...args),
      ...createAccountsSlice(deps)(...args),
      ...createTransactionsSlice(deps)(...args),
      ...createCategoriesSlice(deps)(...args),
      ...createInstallmentsSlice(deps)(...args),
      ...createDashboardSlice(...args),
    })),
  );

export { selectDataState } from './data-slice';
export type {
  DataSlice, UiSlice, SettingsSlice, AccountsSlice, TransactionsSlice, CategoriesSlice,
  InstallmentsSlice, DashboardSlice,
};
