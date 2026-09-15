/* El mismo Inicio en escritorio: rejilla de 3 columnas — el resumen, la dona y
   los movimientos a la izquierda; cuentas y MSI en la barra derecha.

   Recibe EXACTAMENTE los mismos props que `HomeView`, que es lo que permite al
   container elegir una u otra sin cambiar nada más. */

import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { accountTypeFor } from '../../../../shared/design/icons';
import { COLORS } from '../../../../shared/design/tokens';
import { monthLabel } from '../../../../shared/domain/dates';
import { formatMoney } from '../../../../shared/domain/money';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { MsiPlanCard } from '../../../../shared/ui/msi-plan-card';
import { TransactionRow } from '../../../../shared/ui/transaction-row';
import { ExpenseDonut } from './ExpenseDonut';
import type { HomeViewProps } from './HomeView';

export function HomeViewDesktop({
  monthCursor, onPrevMonth, onNextMonth, totalBalance, totalIncome, totalExpense,
  categoryTotals, accounts, balances, recentTxns, categories, installmentPlans,
  activePlans, planProgress, onSliceClick, onSeeAll, onSeeMsi, onOpenMsiPlan, onOpenTxn,
  hideBalances,
}: HomeViewProps) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
              <p className="font-mono-custom font-bold text-4xl mt-1" style={{ color: COLORS.text }}>{formatMoney(totalBalance, hideBalances)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onPrevMonth} aria-label="Mes anterior" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <ChevronLeft size={15} style={{ color: COLORS.textMuted }} />
              </button>
              <p className="text-sm font-medium w-32 text-center" style={{ color: COLORS.text }}>{monthLabel(monthCursor)}</p>
              <button onClick={onNextMonth} aria-label="Mes siguiente" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <ChevronRight size={15} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="rounded-xl p-4" style={{ backgroundColor: COLORS.incomeSoft }}>
              <div className="flex items-center gap-1">
                <ArrowUpRight size={14} style={{ color: COLORS.income }} />
                <span className="text-xs" style={{ color: COLORS.income }}>Ingresos</span>
              </div>
              <p className="font-mono-custom font-semibold text-lg mt-1" style={{ color: COLORS.income }}>{formatMoney(totalIncome, hideBalances)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: COLORS.expenseSoft }}>
              <div className="flex items-center gap-1">
                <ArrowDownRight size={14} style={{ color: COLORS.expense }} />
                <span className="text-xs" style={{ color: COLORS.expense }}>Gastos</span>
              </div>
              <p className="font-mono-custom font-semibold text-lg mt-1" style={{ color: COLORS.expense }}>{formatMoney(totalExpense, hideBalances)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <p className="text-sm font-semibold font-display mb-3" style={{ color: COLORS.text }}>Gastos por categoría</p>
          <ExpenseDonut data={categoryTotals} total={totalExpense} onSliceClick={onSliceClick} hideBalances={hideBalances} />
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Movimientos recientes</p>
            <button onClick={onSeeAll} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
          </div>
          {recentTxns.length === 0 ? (
            <EmptyState text="Aún no hay movimientos este mes." />
          ) : (
            <div>
              {recentTxns.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} hideBalances={hideBalances} />)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
          <p className="text-sm font-semibold font-display mb-3" style={{ color: COLORS.text }}>Cuentas</p>
          <div className="grid grid-cols-2 gap-3">
            {accounts.map(a => {
              const TypeIcon = accountTypeFor(a.type).icon;
              const bal = balances[a.id] || 0;
              return (
                <div key={a.id} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: a.color + '26' }}>
                    <TypeIcon size={15} style={{ color: a.color }} />
                  </div>
                  <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{a.name}</p>
                  <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal, hideBalances)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {activePlans.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses</p>
              <button onClick={onSeeMsi} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
            </div>
            <div className="space-y-2">
              {activePlans.slice(0, 4).map(p => (
                <MsiPlanCard key={p.id} plan={p} progress={planProgress[p.id]} categories={categories} onClick={() => onOpenMsiPlan(p)} hideBalances={hideBalances} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
