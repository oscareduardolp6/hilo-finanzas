/* La misma vista en escritorio: rejilla de 3 columnas en vez de lista.

   Recibe EXACTAMENTE los mismos props que `AccountsView`, que es lo que permite
   que el container elija una u otra sin cambiar nada más. */

import { Plus } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import { typeInfoFor } from './AccountsView';
import type { AccountsViewProps } from './AccountsView';

export function AccountsViewDesktop({ accounts, balances, onAdd, onEdit }: AccountsViewProps) {
  const total = Object.values(balances).reduce((s, v) => s + v, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Tus cuentas</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {accounts.map(a => {
          const typeInfo = typeInfoFor(a.type);
          const TypeIcon = typeInfo.icon;
          const bal = balances[a.id] || 0;
          return (
            <button key={a.id} onClick={() => onEdit(a)} className="text-left p-5 rounded-2xl" style={{ backgroundColor: COLORS.surface }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: a.color + '26' }}>
                <TypeIcon size={19} style={{ color: a.color }} />
              </div>
              <p className="text-sm font-medium" style={{ color: COLORS.text }}>{a.name}</p>
              <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>{typeInfo.label}</p>
              <p className="font-mono-custom text-lg font-semibold mt-3" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-xl p-4 inline-block" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-semibold text-lg mt-0.5" style={{ color: COLORS.text }}>{formatMoney(total)}</p>
      </div>
    </div>
  );
}
