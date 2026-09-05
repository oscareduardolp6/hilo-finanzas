/* Componente de LÓGICA del modal de plan MSI.

   Absorbe el `msiModalOpen && <Modal/>` que estaba duplicado entre el árbol
   móvil y el de escritorio, y los tres derivados que `App` calculaba solo para
   este modal: el avance del plan editado, sus pagos y las tiendas conocidas. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { computeKnownStores } from '../../../transactions/domain/queries';
import { planPayments } from '../../domain/grouping';
import { computePlanProgress } from '../../domain/progress';
import { selectEditingPlan, selectPlanModalOpen } from '../../store/selectors';
import { MsiPlanModal } from '../components/MsiPlanModal';

export type MsiPlanFormContainerProps = {
  desktop?: boolean;
};

export function MsiPlanFormContainer({ desktop }: MsiPlanFormContainerProps) {
  const open = useHiloStore(selectPlanModalOpen);
  const plan = useHiloStore(selectEditingPlan);
  const plans = useHiloStore((s) => s.installmentPlans);
  const transactions = useHiloStore((s) => s.transactions);
  const categories = useHiloStore((s) => s.categories);

  const savePlan = useHiloStore((s) => s.savePlan);
  const deletePlan = useHiloStore((s) => s.deletePlan);
  const closePlanForm = useHiloStore((s) => s.closePlanForm);
  const createCategory = useHiloStore((s) => s.createCategory);

  const progress = useMemo(() => computePlanProgress(plans, transactions), [plans, transactions]);
  const knownStores = useMemo(() => computeKnownStores(transactions, plans), [transactions, plans]);
  const payments = useMemo(
    () => (plan ? planPayments(plan.id, transactions) : []),
    [plan, transactions],
  );

  if (!open) return null;

  return (
    <MsiPlanModal
      plan={plan}
      progress={plan ? (progress[plan.id] ?? null) : null}
      payments={payments}
      // El formulario de un plan solo ofrece categorías de gasto.
      categories={categories.filter((c) => c.type === 'expense')}
      knownStores={knownStores}
      onClose={closePlanForm}
      onSave={savePlan}
      onDelete={() => plan && deletePlan(plan.id)}
      onCreateCategory={createCategory}
      desktop={desktop}
    />
  );
}
