/* La misma pantalla en escritorio: rejilla de 2 columnas en vez de lista.

   Recibe exactamente los mismos props que `MsiView`, que es lo que permite al
   container elegir una u otra sin cambiar nada más. */

import { Plus } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { EmptyState } from '../../../../shared/ui/empty-state';
import { MsiPlanCard } from '../../../../shared/ui/msi-plan-card';
import { groupPlansByStatus } from '../../domain/grouping';
import type { MsiViewProps } from './MsiView';

export function MsiViewDesktop({ plans, progress, categories, onAdd, onOpenPlan, hideBalances }: MsiViewProps) {
  const { active, completed } = groupPlansByStatus(plans, progress);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses (MSI)</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Nuevo
        </button>
      </div>
      <p className="text-xs mb-4" style={{ color: COLORS.textFaint }}>Cada pago que hagas se resta del total automáticamente, aunque no sea un pago completo.</p>

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState text="Aún no registras compras a meses. Usa + Nuevo, o marca una transferencia como pago de MSI." />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState text="No tienes MSI activos por pagar." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {active.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} hideBalances={hideBalances} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textFaint }}>Ya pagados</p>
              <div className="grid grid-cols-2 gap-3">
                {completed.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} muted hideBalances={hideBalances} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
