/* La tarjeta de un plan MSI con su barra de avance. La pintan la pantalla de
   MSI y el bloque "Compras a meses" de Inicio, así que vive en `shared/ui`. */

import { COLORS } from '../design/tokens';
import { formatMoney } from '../domain/money';
import type { Category, InstallmentPlan, PlanProgress } from '../domain/types';

export type MsiPlanCardProps = {
  plan: InstallmentPlan;
  /** Puede faltar: un plan recién creado aún no tiene avance calculado. */
  progress?: PlanProgress | undefined;
  categories: Category[];
  onClick: () => void;
  /** Atenúa la tarjeta; se usa para los ya pagados. */
  muted?: boolean;
  /** Modo privado: los montos se reemplazan por un placeholder. */
  hideBalances?: boolean;
};

export function MsiPlanCard({ plan, progress, categories, onClick, muted, hideBalances }: MsiPlanCardProps) {
  const cat = categories.find(c => c.id === plan.categoryId);
  const prog = progress || { paid: 0, installmentsPaid: 0, remaining: plan.totalAmount, pct: 0, isPaidOff: false };
  return (
    <button onClick={onClick} className="w-full text-left p-3 rounded-xl" style={{ backgroundColor: COLORS.surface, opacity: muted ? 0.7 : 1 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{plan.description}</p>
          <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{plan.store ? plan.store + ' · ' : ''}{cat ? cat.name : ''}</p>
        </div>
        <p className="text-xs font-mono-custom shrink-0" style={{ color: COLORS.textMuted }}>{prog.installmentsPaid.toFixed(1)}/{plan.installmentsCount}</p>
      </div>
      <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <div className="h-1.5 rounded-full" style={{ width: `${prog.pct * 100}%`, backgroundColor: prog.isPaidOff ? COLORS.income : COLORS.accent }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs" style={{ color: COLORS.textFaint }}>{formatMoney(prog.paid, hideBalances)} de {formatMoney(plan.totalAmount, hideBalances)}</p>
        {prog.isPaidOff ? (
          <p className="text-xs font-medium" style={{ color: COLORS.income }}>Pagado ✓</p>
        ) : (
          <p className="text-xs" style={{ color: COLORS.textFaint }}>Quedan {formatMoney(prog.remaining, hideBalances)}</p>
        )}
      </div>
    </button>
  );
}
