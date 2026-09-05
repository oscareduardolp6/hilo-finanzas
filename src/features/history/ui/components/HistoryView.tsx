/* Componente de RENDERIZADO del historial: props → JSX.

   Antes del refactor esta vista derivaba lo suyo (normalizaba la búsqueda,
   filtraba, agrupaba por día y sacaba las categorías de gasto) — y su gemela de
   escritorio repetía las cuatro cosas, literales. Ahora entra todo hecho desde
   `HistoryContainer`; aquí solo queda el layout. */

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { monthLabel } from '../../../../shared/domain/dates';
import type { Account, Category, InstallmentPlan, Transaction } from '../../../../shared/domain/types';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { TransactionRow } from '../../../../shared/ui/transaction-row';
import { HISTORY_TYPE_FILTERS } from '../../domain/filters';

export type HistoryViewProps = {
  /** Ya filtrados y agrupados por día, del más nuevo al más viejo. */
  groups: Array<[string, Transaction[]]>;
  accounts: Account[];
  categories: Category[];
  /** Solo las de gasto: es lo que ofrece el desplegable de categoría. */
  expenseCategories: Category[];
  installmentPlans: InstallmentPlan[];
  knownStores: string[];
  suggestions: string[];
  monthCursor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  showAllTime: boolean;
  onToggleAllTime: () => void;
  /** Hay búsqueda en curso: el pager de mes se deshabilita. */
  searching: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterType: (id: string) => void;
  filterCategory: string;
  onFilterCategory: (id: string) => void;
  filterStore: string;
  onFilterStore: (store: string) => void;
  onOpenTxn: (txn: Transaction) => void;
};

export function HistoryView({
  groups, accounts, categories, expenseCategories, installmentPlans, knownStores, suggestions,
  monthCursor, onPrevMonth, onNextMonth, showAllTime, onToggleAllTime,
  searching, searchQuery, onSearchChange, filterType, onFilterType,
  filterCategory, onFilterCategory, filterStore, onFilterStore, onOpenTxn,
}: HistoryViewProps) {
  return (
    <div className="pt-2">
      <div className="flex items-center gap-2">
        <button onClick={onPrevMonth} disabled={showAllTime || searching} aria-label="Mes anterior" className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ChevronLeft size={14} style={{ color: COLORS.textMuted }} />
        </button>
        <p className="text-sm font-medium flex-1 text-center" style={{ color: COLORS.text }}>{showAllTime || searching ? 'Todo el tiempo' : monthLabel(monthCursor)}</p>
        <button onClick={onNextMonth} disabled={showAllTime || searching} aria-label="Mes siguiente" className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ChevronRight size={14} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      {searching ? (
        <p className="text-xs font-medium mt-2" style={{ color: COLORS.textFaint }}>Buscando en todo el tiempo</p>
      ) : (
        <button onClick={onToggleAllTime} className="text-xs font-medium mt-2" style={{ color: COLORS.accent }}>
          {showAllTime ? 'Ver por mes' : 'Ver todo el tiempo'}
        </button>
      )}

      <div className="relative mt-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
        <input
          type="search"
          list="history-search-list"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar en el historial…"
          className="w-full pl-9 pr-9 py-2 rounded-xl text-sm outline-none"
          style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center" style={{ color: COLORS.textMuted }}>
            <X size={14} />
          </button>
        )}
        <datalist id="history-search-list">
          {suggestions.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto hilo-scroll pb-1">
        {HISTORY_TYPE_FILTERS.map(f => (
          <button key={f.id} onClick={() => onFilterType(f.id)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: filterType === f.id ? COLORS.accent : COLORS.surfaceAlt, color: filterType === f.id ? COLORS.bg : COLORS.textMuted }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <select value={filterCategory} onChange={e => onFilterCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las categorías</option>
          {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStore} onChange={e => onFilterStore(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las tiendas</option>
          {knownStores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-4">
        {groups.length === 0 ? (
          <EmptyState text={searching ? 'No hay movimientos que coincidan.' : 'No hay movimientos con estos filtros.'} />
        ) : groups.map(([label, list]) => (
          <div key={label} className="mt-4 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.textFaint }}>{label}</p>
            {list.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} query={searching ? searchQuery.trim() : undefined} onClick={() => onOpenTxn(t)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
