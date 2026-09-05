/* El mismo historial en escritorio: una sola tarjeta ancha con los filtros en
   una fila en vez de apilados.

   Recibe EXACTAMENTE los mismos props que `HistoryView`, que es lo que permite
   al container elegir una u otra sin cambiar nada más. */

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { monthLabel } from '../../../../shared/domain/dates';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { TransactionRow } from '../../../../shared/ui/transaction-row';
import { HISTORY_TYPE_FILTERS } from '../../domain/filters';
import type { HistoryViewProps } from './HistoryView';

export function HistoryViewDesktop({
  groups, accounts, categories, expenseCategories, installmentPlans, knownStores, suggestions,
  monthCursor, onPrevMonth, onNextMonth, showAllTime, onToggleAllTime,
  searching, searchQuery, onSearchChange, filterType, onFilterType,
  filterCategory, onFilterCategory, filterStore, onFilterStore, onOpenTxn,
}: HistoryViewProps) {
  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onPrevMonth} disabled={showAllTime || searching} aria-label="Mes anterior" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronLeft size={15} style={{ color: COLORS.textMuted }} />
          </button>
          <p className="text-sm font-medium w-32 text-center" style={{ color: COLORS.text }}>{showAllTime || searching ? 'Todo el tiempo' : monthLabel(monthCursor)}</p>
          <button onClick={onNextMonth} disabled={showAllTime || searching} aria-label="Mes siguiente" className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronRight size={15} style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        {searching ? (
          <span className="text-xs font-medium" style={{ color: COLORS.textFaint }}>Buscando en todo el tiempo</span>
        ) : (
          <button onClick={onToggleAllTime} className="text-xs font-medium" style={{ color: COLORS.accent }}>
            {showAllTime ? 'Ver por mes' : 'Ver todo el tiempo'}
          </button>
        )}
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
          <input
            type="search"
            list="history-search-list-desktop"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar en el historial…"
            className="pl-9 pr-9 py-2 rounded-xl text-sm outline-none w-64"
            style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center" style={{ color: COLORS.textMuted }}>
              <X size={14} />
            </button>
          )}
          <datalist id="history-search-list-desktop">
            {suggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        <select value={filterCategory} onChange={e => onFilterCategory(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las categorías</option>
          {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStore} onChange={e => onFilterStore(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las tiendas</option>
          {knownStores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mt-4">
        {HISTORY_TYPE_FILTERS.map(f => (
          <button key={f.id} onClick={() => onFilterType(f.id)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: filterType === f.id ? COLORS.accent : COLORS.surfaceAlt, color: filterType === f.id ? COLORS.bg : COLORS.textMuted }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
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
