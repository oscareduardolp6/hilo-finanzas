/* Componente de LÓGICA del alta/edición de movimiento.

   Reemplaza 15 props que `App` y `DesktopShell` bajaban duplicadas a los dos
   árboles. También se traga el `sheetOpen && <Sheet/>`: devolver `null` cuando
   está cerrado conserva lo que importa — al abrirse, la hoja se monta de cero y
   su estado local (confirmación de borrado, buscadores de cuenta) arranca limpio.

   Sigue sin ver una mónada: `saveTransaction` es, desde aquí, `(form) => void`. */

import { useCallback, useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { computePlanProgress } from '../../../installments/domain/progress';
import type { TransactionFormDraft } from '../../domain/form';
import { computeKnownStores } from '../../domain/queries';
import { selectForm, selectSheetOpen } from '../../store/selectors';
import { AddTransactionSheet } from '../components/AddTransactionSheet';

export type AddTransactionContainerProps = {
  desktop?: boolean;
};

export function AddTransactionContainer({ desktop }: AddTransactionContainerProps) {
  const open = useHiloStore(selectSheetOpen);
  const form = useHiloStore(selectForm);
  const formType = useHiloStore((s) => s.formType);
  const editingId = useHiloStore((s) => s.editingId);

  const accounts = useHiloStore((s) => s.accounts);
  const categories = useHiloStore((s) => s.categories);
  const transactions = useHiloStore((s) => s.transactions);
  const installmentPlans = useHiloStore((s) => s.installmentPlans);
  const benefitPrograms = useHiloStore((s) => s.benefitPrograms);

  const setForm = useHiloStore((s) => s.setForm);
  const closeSheet = useHiloStore((s) => s.closeSheet);
  const saveTransaction = useHiloStore((s) => s.saveTransaction);
  const deleteTransaction = useHiloStore((s) => s.deleteTransaction);
  const switchFormType = useHiloStore((s) => s.switchFormType);
  const createCategory = useHiloStore((s) => s.createCategory);
  const createPlan = useHiloStore((s) => s.createPlan);
  const createProgram = useHiloStore((s) => s.createProgram);

  // `useMemo` y no selectores: ambos derivan colecciones nuevas y zustand v5
  // compara por identidad. Son los mismos memos que tenía `App`.
  const planProgress = useMemo(
    () => computePlanProgress(installmentPlans, transactions),
    [installmentPlans, transactions],
  );
  const knownStores = useMemo(
    () => computeKnownStores(transactions, installmentPlans),
    [transactions, installmentPlans],
  );

  // El setter del store admite `null` (cerrar la hoja lo vacía); la hoja solo
  // actualiza sobre un borrador presente. Este guard concilia las dos firmas sin
  // obligar a cada `setForm(f => ...)` del formulario a comprobar nulos.
  const updateForm = useCallback(
    (update: (f: TransactionFormDraft) => TransactionFormDraft) =>
      setForm((prev) => (prev ? update(prev) : prev)),
    [setForm],
  );

  if (!open) return null;

  return (
    <AddTransactionSheet
      formType={formType}
      editingId={editingId}
      form={form}
      setForm={updateForm}
      accounts={accounts}
      categories={categories}
      plans={installmentPlans}
      planProgress={planProgress}
      benefitPrograms={benefitPrograms}
      knownStores={knownStores}
      onClose={closeSheet}
      onSave={saveTransaction}
      onDelete={deleteTransaction}
      onSwitchType={switchFormType}
      onCreateCategory={createCategory}
      onCreatePlan={createPlan}
      onCreateBenefitProgram={createProgram}
      desktop={desktop}
    />
  );
}
