/* La misma Evolución en escritorio: la gráfica ancha a la izquierda y el resumen
   en una columna a la derecha.

   Recibe EXACTAMENTE los mismos props que `EvolutionView`, que es lo que
   permite al container elegir una u otra sin cambiar nada más. */

import { COLORS } from '../../../../shared/design/tokens';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { BalanceChart } from './BalanceChart';
import { EvolutionSummary } from './EvolutionSummary';
import type { EvolutionViewProps } from './EvolutionView';
import { RangePills } from './RangePills';

export function EvolutionViewDesktop({ range, onRangeChange, series, hasData, hideBalances }: EvolutionViewProps) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Saldo total</p>
          <RangePills value={range} onChange={onRangeChange} />
        </div>
        {hasData ? (
          <BalanceChart series={series} height={340} hideBalances={hideBalances} />
        ) : (
          <EmptyState text="Aún no hay movimientos. Registra el primero para ver cómo evoluciona tu saldo." />
        )}
      </div>
      <div className="rounded-2xl p-6 self-start" style={{ backgroundColor: COLORS.surface }}>
        <EvolutionSummary series={series} hideBalances={hideBalances} desktop />
      </div>
    </div>
  );
}
