/* Estado efímero: navegación, filtros, borrador del formulario y modales.
   Nada de esto se hidrata ni se persiste — igual que antes del refactor. */

import type { StateCreator } from 'zustand';
import { makeSetter } from './setter';
import type { Setter } from './setter';
import type { HiloStore } from './index';

/** El formulario de movimiento es un borrador libre (los inputs son strings),
 *  no un `Transaction`; se convierte a movimiento al guardar. */
export type TransactionForm = Record<string, unknown> | null;

export type UiSlice = {
  activeTab: string;
  monthCursor: Date;
  showAllTime: boolean;
  filterType: string;
  filterCategory: string;
  filterStore: string;
  /** Efímero como los demás filtros: no se hidrata ni se persiste. */
  searchQuery: string;

  sheetOpen: boolean;
  formType: string;
  editingId: string | null;
  form: TransactionForm;

  accountModalOpen: boolean;
  editingAccount: unknown;
  msiModalOpen: boolean;
  editingPlan: unknown;
  settingsOpen: boolean;
  importModalOpen: boolean;
  syncModalOpen: boolean;
  backupModalOpen: boolean;
  receiptModalOpen: boolean;

  toast: string | null;

  setActiveTab: Setter<string>;
  setMonthCursor: Setter<Date>;
  setShowAllTime: Setter<boolean>;
  setFilterType: Setter<string>;
  setFilterCategory: Setter<string>;
  setFilterStore: Setter<string>;
  setSearchQuery: Setter<string>;

  setSheetOpen: Setter<boolean>;
  setFormType: Setter<string>;
  setEditingId: Setter<string | null>;
  setForm: Setter<TransactionForm>;

  setAccountModalOpen: Setter<boolean>;
  setEditingAccount: Setter<unknown>;
  setMsiModalOpen: Setter<boolean>;
  setEditingPlan: Setter<unknown>;
  setSettingsOpen: Setter<boolean>;
  setImportModalOpen: Setter<boolean>;
  setSyncModalOpen: Setter<boolean>;
  setBackupModalOpen: Setter<boolean>;
  setReceiptModalOpen: Setter<boolean>;

  setToast: Setter<string | null>;
};

/** Primer día del mes en curso, a medianoche — el cursor arranca ahí. */
const currentMonthStart = (): Date => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const createUiSlice: StateCreator<HiloStore, [], [], UiSlice> = (set) => ({
  activeTab: 'home',
  monthCursor: currentMonthStart(),
  showAllTime: false,
  filterType: 'all',
  filterCategory: 'all',
  filterStore: 'all',
  searchQuery: '',

  sheetOpen: false,
  formType: 'expense',
  editingId: null,
  form: null,

  accountModalOpen: false,
  editingAccount: null,
  msiModalOpen: false,
  editingPlan: null,
  settingsOpen: false,
  importModalOpen: false,
  syncModalOpen: false,
  backupModalOpen: false,
  receiptModalOpen: false,

  toast: null,

  setActiveTab: makeSetter<HiloStore, 'activeTab'>(set, 'activeTab'),
  setMonthCursor: makeSetter<HiloStore, 'monthCursor'>(set, 'monthCursor'),
  setShowAllTime: makeSetter<HiloStore, 'showAllTime'>(set, 'showAllTime'),
  setFilterType: makeSetter<HiloStore, 'filterType'>(set, 'filterType'),
  setFilterCategory: makeSetter<HiloStore, 'filterCategory'>(set, 'filterCategory'),
  setFilterStore: makeSetter<HiloStore, 'filterStore'>(set, 'filterStore'),
  setSearchQuery: makeSetter<HiloStore, 'searchQuery'>(set, 'searchQuery'),

  setSheetOpen: makeSetter<HiloStore, 'sheetOpen'>(set, 'sheetOpen'),
  setFormType: makeSetter<HiloStore, 'formType'>(set, 'formType'),
  setEditingId: makeSetter<HiloStore, 'editingId'>(set, 'editingId'),
  setForm: makeSetter<HiloStore, 'form'>(set, 'form'),

  setAccountModalOpen: makeSetter<HiloStore, 'accountModalOpen'>(set, 'accountModalOpen'),
  setEditingAccount: makeSetter<HiloStore, 'editingAccount'>(set, 'editingAccount'),
  setMsiModalOpen: makeSetter<HiloStore, 'msiModalOpen'>(set, 'msiModalOpen'),
  setEditingPlan: makeSetter<HiloStore, 'editingPlan'>(set, 'editingPlan'),
  setSettingsOpen: makeSetter<HiloStore, 'settingsOpen'>(set, 'settingsOpen'),
  setImportModalOpen: makeSetter<HiloStore, 'importModalOpen'>(set, 'importModalOpen'),
  setSyncModalOpen: makeSetter<HiloStore, 'syncModalOpen'>(set, 'syncModalOpen'),
  setBackupModalOpen: makeSetter<HiloStore, 'backupModalOpen'>(set, 'backupModalOpen'),
  setReceiptModalOpen: makeSetter<HiloStore, 'receiptModalOpen'>(set, 'receiptModalOpen'),

  setToast: makeSetter<HiloStore, 'toast'>(set, 'toast'),
});
