/* El resumen del plazo: cuánto cambió el dinero (el "ahorro"), con qué saldo
   empezó y con cuál terminó. Componente de RENDERIZADO.

   Con el modo privado activo no se pinta el signo ni el monto, pero sí el
   porcentaje — igual que la dona conserva sus porcentajes. */

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { BalanceSeries } from '../../domain/series';

export type EvolutionSummaryProps = {
  series: BalanceSeries;
  hideBalances?: boolean;
  /** Letras y márgenes más grandes en la versión de escritorio. */
  desktop?: boolean;
};

export function EvolutionSummary({ series, hideBalances, desktop }: EvolutionSummaryProps) {
  const { startBalance, endBalance, change, changePct } = series;
  const up = change > 0;
  const down = change < 0;
  const color = up ? COLORS.income : down ? COLORS.expense : COLORS.textMuted;
  const soft = up ? COLORS.incomeSoft : down ? COLORS.expenseSoft : COLORS.surfaceAlt;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const sign = hideBalances ? '' : up ? '+' : '';
  const pct = changePct === null ? null : `${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`;

  return (
    <div>
      <p className="text-xs" style={{ color: COLORS.textMuted }}>{down ? 'Cambio en el plazo' : 'Ahorro en el plazo'}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <p className={`font-mono-custom font-bold ${desktop ? 'text-4xl' : 'text-3xl'}`} style={{ color }}>
          {sign}{formatMoney(change, hideBalances)}
        </p>
        {pct && (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: soft, color }}>
            <Icon size={12} />{pct}
          </span>
        )}
      </div>
      <div className={`grid grid-cols-2 gap-3 ${desktop ? 'mt-5' : 'mt-4'}`}>
        <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo inicial</p>
          <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: COLORS.text }}>{formatMoney(startBalance, hideBalances)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo final</p>
          <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: COLORS.text }}>{formatMoney(endBalance, hideBalances)}</p>
        </div>
      </div>
    </div>
  );
}
