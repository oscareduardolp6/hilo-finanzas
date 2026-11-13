/* Evolución en móvil. Componente de RENDERIZADO: props → JSX, sin store ni casos
   de uso. Su versión de escritorio es `EvolutionViewDesktop`, con los mismos
   props. */

import { COLORS } from '../../../../shared/design/tokens';
import { EmptyState } from '../../../../shared/ui/empty-state';
import type { BalanceSeries, EvolutionRangeId } from '../../domain/series';
import { BalanceChart } from './BalanceChart';
import { EvolutionSummary } from './EvolutionSummary';
import { RangePills } from './RangePills';

export type EvolutionViewProps = {
  range: EvolutionRangeId;
  onRangeChange: (id: EvolutionRangeId) => void;
  series: BalanceSeries;
  /** `false` cuando aún no hay un solo movimiento: no hay nada que graficar. */
  hasData: boolean;
  /** Modo privado: todo monto se reemplaza por un placeholder. */
  hideBalances?: boolean;
};

export function EvolutionView({ range, onRangeChange, series, hasData, hideBalances }: EvolutionViewProps) {
  return (
    <div className="pt-2">
      <RangePills value={range} onChange={onRangeChange} />
      <div className="rounded-2xl p-5 mt-3" style={{ backgroundColor: COLORS.surface }}>
        <EvolutionSummary series={series} hideBalances={hideBalances} />
      </div>
      <div className="rounded-2xl p-4 mt-4" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-sm font-semibold font-display mb-2 px-1" style={{ color: COLORS.text }}>Saldo total</p>
        {hasData ? (
          <BalanceChart series={series} hideBalances={hideBalances} />
        ) : (
          <EmptyState text="Aún no hay movimientos. Registra el primero para ver cómo evoluciona tu saldo." />
        )}
      </div>
    </div>
  );
}
