/* Componente de LÓGICA de la pestaña MSI: lee el store y liga las acciones. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { computePlanProgress } from '../../domain/progress';
import { selectPlans } from '../../store/selectors';
import { MsiView } from '../components/MsiView';
import { MsiViewDesktop } from '../components/MsiViewDesktop';

export type MsiContainerProps = {
  desktop?: boolean;
};

export function MsiContainer({ desktop }: MsiContainerProps) {
  const plans = useHiloStore(selectPlans);
  const transactions = useHiloStore((s) => s.transactions);
  const categories = useHiloStore((s) => s.categories);
  const openPlanForm = useHiloStore((s) => s.openPlanForm);
  const hideBalances = useHiloStore((s) => s.hideBalances);

  // `useMemo` y no un selector: `computePlanProgress` devuelve un objeto nuevo
  // y zustand v5 compara por identidad.
  const progress = useMemo(() => computePlanProgress(plans, transactions), [plans, transactions]);

  const View = desktop ? MsiViewDesktop : MsiView;

  return (
    <View
      plans={plans}
      progress={progress}
      categories={categories}
      onAdd={() => openPlanForm(null)}
      onOpenPlan={(plan) => openPlanForm(plan)}
      hideBalances={hideBalances}
    />
  );
}
