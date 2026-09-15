/* Componente de LÓGICA del historial: lee el store, deriva y liga los filtros.

   Aquí se junta lo que estaba en dos sitios a la vez: los dos `useMemo` que le
   quedaban a `AppBody` (tiendas conocidas y sugerencias) y las cuatro
   derivaciones que cada vista repetía por su cuenta (normalizar la búsqueda,
   filtrar, agrupar por día y sacar las categorías de gasto).

   Los filtros son campos del `ui-slice`, así que esta feature no necesita slice
   propio: liga sus setters. La única acción de historial que existe vive en
   `dashboard` (`showCategoryInHistory`), porque el disparo es de allá. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { addMonths } from '../../../../shared/domain/dates';
import { groupByDate } from '../../../../shared/domain/grouping';
import { normalizeForSearch } from '../../../../shared/domain/search';
import { computeKnownStores } from '../../../transactions/domain/queries';
import { computeHistorySuggestions, filterHistoryTransactions } from '../../domain/filters';
import { HistoryView } from '../components/HistoryView';
import { HistoryViewDesktop } from '../components/HistoryViewDesktop';

export type HistoryContainerProps = {
  desktop?: boolean;
};

export function HistoryContainer({ desktop }: HistoryContainerProps) {
  const accounts = useHiloStore((s) => s.accounts);
  const categories = useHiloStore((s) => s.categories);
  const transactions = useHiloStore((s) => s.transactions);
  const installmentPlans = useHiloStore((s) => s.installmentPlans);

  const monthCursor = useHiloStore((s) => s.monthCursor);
  const showAllTime = useHiloStore((s) => s.showAllTime);
  const filterType = useHiloStore((s) => s.filterType);
  const filterCategory = useHiloStore((s) => s.filterCategory);
  const filterStore = useHiloStore((s) => s.filterStore);
  const searchQuery = useHiloStore((s) => s.searchQuery);
  const hideBalances = useHiloStore((s) => s.hideBalances);

  const setMonthCursor = useHiloStore((s) => s.setMonthCursor);
  const setShowAllTime = useHiloStore((s) => s.setShowAllTime);
  const setFilterType = useHiloStore((s) => s.setFilterType);
  const setFilterCategory = useHiloStore((s) => s.setFilterCategory);
  const setFilterStore = useHiloStore((s) => s.setFilterStore);
  const setSearchQuery = useHiloStore((s) => s.setSearchQuery);
  const openEditSheet = useHiloStore((s) => s.openEditSheet);

  const q = normalizeForSearch((searchQuery || '').trim());
  const searching = q.length > 0;

  const filtered = useMemo(
    () => filterHistoryTransactions({
      transactions, installmentPlans, showAllTime, searching, q, monthCursor,
      filterType, filterCategory, filterStore,
    }),
    [transactions, installmentPlans, showAllTime, searching, q, monthCursor, filterType, filterCategory, filterStore],
  );

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  const knownStores = useMemo(
    () => computeKnownStores(transactions, installmentPlans),
    [transactions, installmentPlans],
  );
  const suggestions = useMemo(
    () => computeHistorySuggestions(transactions, installmentPlans),
    [transactions, installmentPlans],
  );

  const View = desktop ? HistoryViewDesktop : HistoryView;

  return (
    <View
      groups={groups}
      accounts={accounts}
      categories={categories}
      expenseCategories={expenseCategories}
      installmentPlans={installmentPlans}
      knownStores={knownStores}
      suggestions={suggestions}
      monthCursor={monthCursor}
      onPrevMonth={() => setMonthCursor((d) => addMonths(d, -1))}
      onNextMonth={() => setMonthCursor((d) => addMonths(d, 1))}
      showAllTime={showAllTime}
      onToggleAllTime={() => setShowAllTime((s) => !s)}
      searching={searching}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filterType={filterType}
      onFilterType={setFilterType}
      filterCategory={filterCategory}
      onFilterCategory={setFilterCategory}
      filterStore={filterStore}
      onFilterStore={setFilterStore}
      onOpenTxn={openEditSheet}
      hideBalances={hideBalances}
    />
  );
}
