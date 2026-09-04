/* Las 5 colecciones que se persisten, más el flag de hidratación.

   Es el único estado que sale y entra de IndexedDB; todo lo demás (filtros,
   modales, borrador del formulario) es efímero y vive en `ui-slice`. */

import type { StateCreator } from 'zustand';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  buildDefaultInstallmentPlans,
  buildDefaultTransactions,
} from '../../shared/domain/defaults';
import type {
  Account,
  Category,
  DataState,
  InstallmentPlan,
  Tombstone,
  Transaction,
} from '../../shared/domain/types';
import { hydrate } from '../application/hydrate';
import type { Deps } from '../dependencies';
import { runRT } from '../run';
import { makeSetter } from './setter';
import type { Setter } from './setter';
import type { HiloStore } from './index';

export type DataSlice = {
  /** Hasta que no sea `true`, `App` pinta "Cargando…" y no se persiste nada. */
  loaded: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  tombstones: Tombstone[];

  setAccounts: Setter<Account[]>;
  setCategories: Setter<Category[]>;
  setTransactions: Setter<Transaction[]>;
  setInstallmentPlans: Setter<InstallmentPlan[]>;
  setTombstones: Setter<Tombstone[]>;

  /** Corre el caso de uso `hydrate` y vuelca el resultado. */
  hydrateFromRepositories: () => Promise<void>;
};

/** Las 5 colecciones tal como se guardan, sin lo efímero. */
export const selectDataState = (state: DataSlice): DataState => ({
  accounts: state.accounts,
  categories: state.categories,
  transactions: state.transactions,
  installmentPlans: state.installmentPlans,
  tombstones: state.tombstones,
});

export const createDataSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], DataSlice> =>
  (set) => ({
    loaded: false,
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    transactions: buildDefaultTransactions(),
    installmentPlans: buildDefaultInstallmentPlans(),
    tombstones: [],

    setAccounts: makeSetter<HiloStore, 'accounts'>(set, 'accounts'),
    setCategories: makeSetter<HiloStore, 'categories'>(set, 'categories'),
    setTransactions: makeSetter<HiloStore, 'transactions'>(set, 'transactions'),
    setInstallmentPlans: makeSetter<HiloStore, 'installmentPlans'>(set, 'installmentPlans'),
    setTombstones: makeSetter<HiloStore, 'tombstones'>(set, 'tombstones'),

    hydrateFromRepositories: async () => {
      const { data, ocrSettings, syncState } = await runRT(hydrate, deps);
      // UN SOLO `set`, a propósito: el suscriptor de persistencia observa las 5
      // colecciones y `loaded` a la vez, así que esto dispara exactamente un
      // guardado — el mismo que hacía el `useEffect` original al pasar `loaded`
      // a true, que reescribía la semilla de demo en un perfil nuevo.
      set({
        // Cada colección solo se pisa si venía en el blob: un blob viejo puede
        // no traer `tombstones`, y ahí se conserva el valor inicial.
        ...(data?.accounts ? { accounts: data.accounts } : {}),
        ...(data?.categories ? { categories: data.categories } : {}),
        ...(data?.transactions ? { transactions: data.transactions } : {}),
        ...(data?.installmentPlans ? { installmentPlans: data.installmentPlans } : {}),
        ...(data?.tombstones ? { tombstones: data.tombstones } : {}),
        ...(ocrSettings
          ? { ocrSettings: { apiKey: ocrSettings.apiKey || '', model: ocrSettings.model || '' } }
          : {}),
        syncState,
        loaded: true,
      });
    },
  });
