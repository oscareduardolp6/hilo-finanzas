/* Componente de RENDERIZADO: props → JSX. No conoce el store ni los casos de
   uso. Su versión de escritorio es `AccountsViewDesktop`, con los mismos props. */

import { Plus } from 'lucide-react';
import { accountTypeFor } from '../../../../shared/design/icons';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { Account } from '../../../../shared/domain/types';
import type { Balances } from '../../domain/balance';

export type AccountsViewProps = {
  accounts: Account[];
  balances: Balances;
  onAdd: () => void;
  onEdit: (account: Account) => void;
};

export function AccountsView({ accounts, balances, onAdd, onEdit }: AccountsViewProps) {
  const total = Object.values(balances).reduce((s, v) => s + v, 0);
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Tus cuentas</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {accounts.map(a => {
          const typeInfo = accountTypeFor(a.type);
          const TypeIcon = typeInfo.icon;
          const bal = balances[a.id] || 0;
          return (
            <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left" style={{ backgroundColor: COLORS.surface }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: a.color + '26' }}>
                <TypeIcon size={17} style={{ color: a.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: COLORS.text }}>{a.name}</p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{typeInfo.label}</p>
              </div>
              <p className="font-mono-custom text-sm font-semibold" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-semibold text-lg mt-0.5" style={{ color: COLORS.text }}>{formatMoney(total)}</p>
      </div>
    </div>
  );
}
