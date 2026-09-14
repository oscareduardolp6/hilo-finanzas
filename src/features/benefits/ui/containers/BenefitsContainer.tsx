/* Componente de LÓGICA del modal de Ajustes "Beneficios y promociones".

   Calcula los dos cortes de fecha fijos que pidió la tarea (mes actual y
   últimos 6 meses) y deriva los totales con `computeBenefitTotals` — el
   componente no ve el store de instalación de MSI ni nada más allá de lo
   que necesita. */

import { useMemo } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { addMonths, isoFromEpoch, monthKey } from '../../../../shared/domain/dates';
import { computeBenefitTotals } from '../../domain/totals';
import { BenefitsModal } from '../components/BenefitsModal';

export type BenefitsContainerProps = {
  desktop?: boolean;
};

export function BenefitsContainer({ desktop }: BenefitsContainerProps) {
  const open = useHiloStore((s) => s.benefitsModalOpen);
  if (!open) return null;
  return <BenefitsSheet desktop={desktop} />;
}

function BenefitsSheet({ desktop }: BenefitsContainerProps) {
  const programs = useHiloStore((s) => s.benefitPrograms);
  const accounts = useHiloStore((s) => s.accounts);
  const transactions = useHiloStore((s) => s.transactions);
  const editingProgram = useHiloStore((s) => s.editingBenefitProgram);

  const setOpen = useHiloStore((s) => s.setBenefitsModalOpen);
  const setEditingProgram = useHiloStore((s) => s.setEditingBenefitProgram);
  const saveProgram = useHiloStore((s) => s.saveProgram);
  const deleteProgram = useHiloStore((s) => s.deleteProgram);

  const { totalsThisMonth, totalsLast6Months } = useMemo(() => {
    const now = new Date();
    const thisMonthStart = `${monthKey(now)}-01`;
    const sixMonthsAgo = isoFromEpoch(addMonths(now, -6).getTime());
    return {
      totalsThisMonth: computeBenefitTotals(transactions, programs, thisMonthStart),
      totalsLast6Months: computeBenefitTotals(transactions, programs, sixMonthsAgo),
    };
  }, [transactions, programs]);

  return (
    <BenefitsModal
      programs={programs}
      accounts={accounts}
      totalsThisMonth={totalsThisMonth}
      totalsLast6Months={totalsLast6Months}
      editingProgram={editingProgram}
      onStartEdit={setEditingProgram}
      onSave={saveProgram}
      onDelete={deleteProgram}
      onClose={() => { setOpen(false); setEditingProgram(null); }}
      desktop={desktop}
    />
  );
}
