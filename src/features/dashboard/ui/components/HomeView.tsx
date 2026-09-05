/* Componente de RENDERIZADO de Inicio: props → JSX, sin store ni casos de uso.
   Todo lo derivado (saldos, totales, planes activos) entra ya calculado desde
   `HomeContainer`. Su versión de escritorio es `HomeViewDesktop`, con los
   mismos props. */

import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { accountTypeFor } from '../../../../shared/design/icons';
import { COLORS } from '../../../../shared/design/tokens';
import { monthLabel } from '../../../../shared/domain/dates';
import { formatMoney } from '../../../../shared/domain/money';
import type {
  Account, Category, InstallmentPlan, PlanProgress, Transaction,
} from '../../../../shared/domain/types';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { MsiPlanCard } from '../../../../shared/ui/msi-plan-card';
import { TransactionRow } from '../../../../shared/ui/transaction-row';
import type { Balances } from '../../../accounts/domain/balance';
import type { CategoryTotal } from '../../domain/totals';
import { ExpenseDonut } from './ExpenseDonut';

export type HomeViewProps = {
  monthCursor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  categoryTotals: CategoryTotal[];
  accounts: Account[];
  balances: Balances;
  recentTxns: Transaction[];
  categories: Category[];
  /** Todos los planes: los necesita `TransactionRow` para etiquetar un abono. */
  installmentPlans: InstallmentPlan[];
  /** Solo los que aún deben algo, ya filtrados y en orden. */
  activePlans: InstallmentPlan[];
  planProgress: Record<string, PlanProgress>;
  onSliceClick: (categoryId: string) => void;
  onSeeAll: () => void;
  onSeeMsi: () => void;
  onOpenMsiPlan: (plan: InstallmentPlan) => void;
  onOpenTxn: (txn: Transaction) => void;
};

export function HomeView({
  monthCursor, onPrevMonth, onNextMonth, totalBalance, totalIncome, totalExpense,
  categoryTotals, accounts, balances, recentTxns, categories, installmentPlans,
  activePlans, planProgress, onSliceClick, onSeeAll, onSeeMsi, onOpenMsiPlan, onOpenTxn,
}: HomeViewProps) {
  return (
    <div className="pt-2">
      <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-bold text-3xl mt-1" style={{ color: COLORS.text }}>{formatMoney(totalBalance)}</p>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={onPrevMonth} aria-label="Mes anterior" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronLeft size={14} style={{ color: COLORS.textMuted }} />
          </button>
          <p className="text-sm font-medium flex-1 text-center" style={{ color: COLORS.text }}>{monthLabel(monthCursor)}</p>
          <button onClick={onNextMonth} aria-label="Mes siguiente" className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronRight size={14} style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.incomeSoft }}>
            <div className="flex items-center gap-1">
              <ArrowUpRight size={13} style={{ color: COLORS.income }} />
              <span className="text-xs" style={{ color: COLORS.income }}>Ingresos</span>
            </div>
            <p className="font-mono-custom font-semibold mt-1" style={{ color: COLORS.income }}>{formatMoney(totalIncome)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <div className="flex items-center gap-1">
              <ArrowDownRight size={13} style={{ color: COLORS.expense }} />
              <span className="text-xs" style={{ color: COLORS.expense }}>Gastos</span>
            </div>
            <p className="font-mono-custom font-semibold mt-1" style={{ color: COLORS.expense }}>{formatMoney(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 mt-4" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-sm font-semibold font-display mb-2" style={{ color: COLORS.text }}>Gastos por categoría</p>
        <ExpenseDonut data={categoryTotals} total={totalExpense} onSliceClick={onSliceClick} />
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold font-display mb-2" style={{ color: COLORS.text }}>Cuentas</p>
        <div className="flex gap-3 overflow-x-auto hilo-scroll pb-1">
          {accounts.map(a => {
            const TypeIcon = accountTypeFor(a.type).icon;
            const bal = balances[a.id] || 0;
            return (
              <div key={a.id} className="shrink-0 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, minWidth: 130 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: a.color + '26' }}>
                  <TypeIcon size={15} style={{ color: a.color }} />
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{a.name}</p>
                <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {activePlans.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses</p>
            <button onClick={onSeeMsi} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
          </div>
          <div className="space-y-2">
            {activePlans.slice(0, 3).map(p => (
              <MsiPlanCard key={p.id} plan={p} progress={planProgress[p.id]} categories={categories} onClick={() => onOpenMsiPlan(p)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Movimientos recientes</p>
          <button onClick={onSeeAll} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
        </div>
        {recentTxns.length === 0 ? (
          <EmptyState text="Aún no hay movimientos este mes." />
        ) : (
          <div>
            {recentTxns.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
