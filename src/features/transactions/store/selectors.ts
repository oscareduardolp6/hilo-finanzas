/* Selectores de la feature. Otras features pueden importarlos; su `ui/` no.

   Los que derivan una colección nueva (`selectPeriodTransactions`,
   `selectKnownStores`) NO se pasan a `useHiloStore`: devuelven un array nuevo
   en cada llamada y zustand v5 compara por identidad. Van dentro de un
   `useMemo` sobre las colecciones, igual que los `useMemo` de `App`. */

import type { HiloStore } from '../../../app/store';
import { monthKey } from '../../../shared/domain/dates';
import type { InstallmentPlan, Transaction, TransactionType } from '../../../shared/domain/types';
import { computeKnownStores, computePeriodTransactions } from '../domain/queries';
import type { TransactionFormDraft } from '../domain/form';

export const selectTransactions = (s: HiloStore): Transaction[] => s.transactions;
export const selectSheetOpen = (s: HiloStore): boolean => s.sheetOpen;
export const selectFormType = (s: HiloStore): TransactionType => s.formType;
export const selectEditingId = (s: HiloStore): string | null => s.editingId;
export const selectForm = (s: HiloStore): TransactionFormDraft | null => s.form;

/** El mes que se está mirando, como `YYYY-MM`. */
export const selectPeriodKey = (s: { monthCursor: Date }): string => monthKey(s.monthCursor);

/** Envuélvelos en `useMemo`: devuelven colecciones nuevas. */
export const selectPeriodTransactions = (s: { transactions: Transaction[]; monthCursor: Date }): Transaction[] =>
  computePeriodTransactions(s.transactions, selectPeriodKey(s));

export const selectKnownStores = (s: {
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
}): string[] => computeKnownStores(s.transactions, s.installmentPlans);
