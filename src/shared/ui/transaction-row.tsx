/* La fila de un movimiento en una lista. La pintan Inicio y el historial, así
   que vive en `shared/ui`: una feature no importa el `ui/` de otra.

   Compacta a propósito — los detalles de producto (`size`/`brand`/`quantity`)
   NO se muestran aquí, solo al abrir el movimiento. */

import { ArrowRightLeft, Layers } from 'lucide-react';
import { IconFor } from '../design/icons';
import { COLORS } from '../design/tokens';
import { formatMoney } from '../domain/money';
import type { Account, Category, InstallmentPlan, Transaction } from '../domain/types';
import { highlightMatch } from './highlight';

export type TransactionRowProps = {
  txn: Transaction;
  accounts: Account[];
  categories: Category[];
  plans?: InstallmentPlan[];
  /** Si viene, se resalta dentro de la descripción y la tienda. */
  query?: string | undefined;
  onClick: () => void;
};

export function TransactionRow({ txn, accounts, categories, plans, query, onClick }: TransactionRowProps) {
  const accById = (id: string | undefined) => accounts.find(a => a.id === id);

  if (txn.type === 'transfer') {
    const fromAcc = accById(txn.fromAccountId);
    const toAcc = accById(txn.toAccountId);
    // La categoría solo se pinta si la transferencia cuenta como gasto.
    const cat = txn.taggedAsExpense ? categories.find(c => c.id === txn.categoryId) : null;
    const CatIcon = cat ? IconFor(cat.icon) : null;
    const plan = txn.installmentPlanId ? (plans || []).find(p => p.id === txn.installmentPlanId) : null;
    return (
      <button onClick={onClick} className="w-full flex items-start gap-3 py-3 border-b text-left" style={{ borderColor: COLORS.border }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.accentSoft }}>
          <ArrowRightLeft size={17} style={{ color: COLORS.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium" style={{ color: COLORS.text }}>{txn.description ? highlightMatch(txn.description, query) : 'Transferencia'}</p>
            <p className="font-mono-custom text-sm font-semibold shrink-0" style={{ color: txn.taggedAsExpense ? COLORS.expense : COLORS.text }}>
              {txn.taggedAsExpense ? '-' : ''}{formatMoney(txn.amount)}
            </p>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>{fromAcc ? fromAcc.name : '—'} → {toAcc ? toAcc.name : '—'}</p>
          {cat && CatIcon && (
            <div className="flex items-center gap-1.5 mt-1.5 pl-2" style={{ borderLeft: `2px dashed ${cat.color}` }}>
              <CatIcon size={12} style={{ color: cat.color }} />
              <span className="text-xs font-medium" style={{ color: cat.color }}>Cuenta como gasto · {cat.name}</span>
            </div>
          )}
          {plan && (
            <div className="flex items-center gap-1.5 mt-1 pl-2" style={{ borderLeft: `2px dashed ${COLORS.accent}` }}>
              <Layers size={12} style={{ color: COLORS.accent }} />
              <span className="text-xs font-medium" style={{ color: COLORS.accent }}>MSI · {plan.description}{plan.store ? ` (${plan.store})` : ''}</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  const acc = accById(txn.accountId);
  const cat = categories.find(c => c.id === txn.categoryId);
  const Icon = IconFor(cat ? cat.icon : null);
  const isExpense = txn.type === 'expense';
  const plan = txn.type === 'expense' && txn.installmentPlanId
    ? (plans || []).find(p => p.id === txn.installmentPlanId)
    : null;
  const store = txn.type === 'expense' ? txn.store : null;
  return (
    <button onClick={onClick} className="w-full flex items-start gap-3 py-3 border-b text-left" style={{ borderColor: COLORS.border }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: (cat ? cat.color : COLORS.textMuted) + '26' }}>
        <Icon size={17} style={{ color: cat ? cat.color : COLORS.textMuted }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" style={{ color: COLORS.text }}>{txn.description ? highlightMatch(txn.description, query) : (cat ? cat.name : 'Movimiento')}</p>
          <p className="font-mono-custom text-sm font-semibold shrink-0" style={{ color: isExpense ? COLORS.expense : COLORS.income }}>
            {isExpense ? '-' : '+'}{formatMoney(txn.amount)}
          </p>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>{cat ? cat.name : ''}{cat && acc ? ' · ' : ''}{acc ? acc.name : ''}{store ? <> · {highlightMatch(store, query)}</> : ''}</p>
        {plan && (
          <div className="flex items-center gap-1.5 mt-1.5 pl-2" style={{ borderLeft: `2px dashed ${COLORS.accent}` }}>
            <Layers size={12} style={{ color: COLORS.accent }} />
            <span className="text-xs font-medium" style={{ color: COLORS.accent }}>MSI · {plan.description}{plan.store ? ` (${plan.store})` : ''}</span>
          </div>
        )}
      </div>
    </button>
  );
}
