/* Componente de RENDERIZADO de la pestaña MSI. Props → JSX, sin store.

   Su versión de escritorio, `MsiViewDesktop`, es un componente aparte con los
   mismos props: los dos árboles se mantienen paralelos a propósito (ver
   tasks/desktop-view.md). Lo único que sí se compartió es la partición
   activos/pagados, que ahora vive en `domain/grouping.ts`. */

import { Plus } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import type { Category, InstallmentPlan, PlanProgress } from '../../../../shared/domain/types';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { MsiPlanCard } from '../../../../shared/ui/msi-plan-card';
import { groupPlansByStatus } from '../../domain/grouping';

export type MsiViewProps = {
  plans: InstallmentPlan[];
  progress: Record<string, PlanProgress>;
  categories: Category[];
  onAdd: () => void;
  onOpenPlan: (plan: InstallmentPlan) => void;
  /** Modo privado: los montos se reemplazan por un placeholder. */
  hideBalances?: boolean;
};

export function MsiView({ plans, progress, categories, onAdd, onOpenPlan, hideBalances }: MsiViewProps) {
  const { active, completed } = groupPlansByStatus(plans, progress);

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses (MSI)</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Nuevo
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Cada pago que hagas se resta del total automáticamente, aunque no sea un pago completo.</p>

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState text="Aún no registras compras a meses. Usa + Nuevo, o marca una transferencia como pago de MSI." />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState text="No tienes MSI activos por pagar." />
          ) : (
            <div className="space-y-2">
              {active.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} hideBalances={hideBalances} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textFaint }}>Ya pagados</p>
              <div className="space-y-2">
                {completed.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} muted hideBalances={hideBalances} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
