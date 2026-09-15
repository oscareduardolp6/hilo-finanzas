/* Componente de LÓGICA de Inicio: lee el store, deriva y liga acciones.

   Aquí se concentran los siete `useMemo` que tenía `App` — son los mismos, con
   las mismas dependencias. Van en `useMemo` y no en selectores porque todos
   devuelven un objeto o un array nuevo, y zustand v5 compara por identidad:
   pasarlos a `useHiloStore` sería un bucle de render.

   Inicio es la vista que más cruza features: los saldos son de `accounts`, los
   movimientos del periodo de `transactions` y el avance de `installments`. Solo
   importa su `domain/` y sus acciones del store, nunca su `ui/`. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { addMonths, monthKey } from '../../../../shared/domain/dates';
import { computeBalances, computeTotalBalance } from '../../../accounts/domain/balance';
import { activePlans as selectActivePlans } from '../../../installments/domain/grouping';
import { computePlanProgress } from '../../../installments/domain/progress';
import { computePeriodTransactions, computeRecentTxns } from '../../../transactions/domain/queries';
import { computeCategoryTotals, computeTotalExpense, computeTotalIncome } from '../../domain/totals';
import { HomeView } from '../components/HomeView';
import { HomeViewDesktop } from '../components/HomeViewDesktop';

export type HomeContainerProps = {
  desktop?: boolean;
};

export function HomeContainer({ desktop }: HomeContainerProps) {
  const accounts = useHiloStore((s) => s.accounts);
  const categories = useHiloStore((s) => s.categories);
  const transactions = useHiloStore((s) => s.transactions);
  const installmentPlans = useHiloStore((s) => s.installmentPlans);
  const monthCursor = useHiloStore((s) => s.monthCursor);
  const hideBalances = useHiloStore((s) => s.hideBalances);

  const setActiveTab = useHiloStore((s) => s.setActiveTab);
  const setMonthCursor = useHiloStore((s) => s.setMonthCursor);
  const showCategoryInHistory = useHiloStore((s) => s.showCategoryInHistory);
  const openPlanForm = useHiloStore((s) => s.openPlanForm);
  const openEditSheet = useHiloStore((s) => s.openEditSheet);

  const balances = useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);
  const totalBalance = useMemo(() => computeTotalBalance(balances), [balances]);

  const periodKey = monthKey(monthCursor);
  const periodTransactions = useMemo(
    () => computePeriodTransactions(transactions, periodKey),
    [transactions, periodKey],
  );

  const totalIncome = useMemo(() => computeTotalIncome(periodTransactions), [periodTransactions]);
  const totalExpense = useMemo(() => computeTotalExpense(periodTransactions), [periodTransactions]);
  const categoryTotals = useMemo(
    () => computeCategoryTotals(periodTransactions, categories),
    [periodTransactions, categories],
  );
  const recentTxns = useMemo(() => computeRecentTxns(periodTransactions, 5), [periodTransactions]);

  const planProgress = useMemo(
    () => computePlanProgress(installmentPlans, transactions),
    [installmentPlans, transactions],
  );
  const activePlans = useMemo(
    () => selectActivePlans(installmentPlans, planProgress),
    [installmentPlans, planProgress],
  );

  const View = desktop ? HomeViewDesktop : HomeView;

  return (
    <View
      monthCursor={monthCursor}
      onPrevMonth={() => setMonthCursor((d) => addMonths(d, -1))}
      onNextMonth={() => setMonthCursor((d) => addMonths(d, 1))}
      totalBalance={totalBalance}
      totalIncome={totalIncome}
      totalExpense={totalExpense}
      categoryTotals={categoryTotals}
      accounts={accounts}
      balances={balances}
      recentTxns={recentTxns}
      categories={categories}
      installmentPlans={installmentPlans}
      activePlans={activePlans}
      planProgress={planProgress}
      onSliceClick={showCategoryInHistory}
      onSeeAll={() => setActiveTab('history')}
      onSeeMsi={() => setActiveTab('msi')}
      onOpenMsiPlan={openPlanForm}
      onOpenTxn={openEditSheet}
      hideBalances={hideBalances}
    />
  );
}
