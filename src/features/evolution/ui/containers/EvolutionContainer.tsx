/* Componente de LÓGICA de Evolución: lee el store, deriva la serie y liga el
   selector de plazo. No pinta nada por sí mismo.

   La serie va en `useMemo` y no en un selector porque devuelve un objeto nuevo,
   y zustand v5 compara por identidad: pasarla a `useHiloStore` sería un bucle de
   render. "Hoy" sale de `todayIso()` y no del reloj inyectado, como el cursor de
   mes de Inicio; los tests usan fechas relativas a hoy. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { todayIso } from '../../../../shared/domain/dates';
import { computeBalanceSeries } from '../../domain/series';
import { EvolutionView } from '../components/EvolutionView';
import { EvolutionViewDesktop } from '../components/EvolutionViewDesktop';

export type EvolutionContainerProps = {
  desktop?: boolean;
};

export function EvolutionContainer({ desktop }: EvolutionContainerProps) {
  const accounts = useHiloStore((s) => s.accounts);
  const transactions = useHiloStore((s) => s.transactions);
  const range = useHiloStore((s) => s.evolutionRange);
  const hideBalances = useHiloStore((s) => s.hideBalances);
  const setEvolutionRange = useHiloStore((s) => s.setEvolutionRange);

  const series = useMemo(
    () => computeBalanceSeries(accounts, transactions, range, todayIso()),
    [accounts, transactions, range],
  );

  const View = desktop ? EvolutionViewDesktop : EvolutionView;

  return (
    <View
      range={range}
      onRangeChange={setEvolutionRange}
      series={series}
      hasData={transactions.length > 0}
      hideBalances={hideBalances}
    />
  );
}
