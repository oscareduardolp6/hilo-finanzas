/* Componente de RENDERIZADO del alta/edición de un plan MSI.

   Conserva su `useState` local: es borrador de UI, no dominio. El progreso y
   los pagos entran ya calculados por props — el componente no deriva nada. */

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { formatDateLabel, todayIso } from '../../../../shared/domain/dates';
import { formatMoney } from '../../../../shared/domain/money';
import type {
  Category, InstallmentPlan, NewCategory, PlanProgress, Transaction,
} from '../../../../shared/domain/types';
import { CategoryPicker } from '../../../../shared/ui/category-picker';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import { StoreInput } from '../../../../shared/ui/store-input';
import type { PlanInput } from '../../application/save-plan';

export type MsiPlanModalProps = {
  /** `null` = alta. */
  plan: InstallmentPlan | null;
  progress: PlanProgress | null;
  /** Abonos ya registrados, del más reciente al más viejo. */
  payments: Transaction[];
  categories: Category[];
  knownStores: string[];
  onClose: () => void;
  onSave: (input: PlanInput) => void;
  onDelete: () => void;
  onCreateCategory: (category: NewCategory) => Category;
  desktop?: boolean;
};

export function MsiPlanModal({
  plan, progress, payments, categories, knownStores, onClose, onSave, onDelete, onCreateCategory, desktop,
}: MsiPlanModalProps) {
  const [description, setDescription] = useState(plan ? plan.description : '');
  const [store, setStore] = useState(plan ? (plan.store || '') : '');
  const [totalAmount, setTotalAmount] = useState(plan ? String(plan.totalAmount) : '');
  const [installmentsCount, setInstallmentsCount] = useState(plan ? String(plan.installmentsCount) : '6');
  const [categoryId, setCategoryId] = useState(plan ? plan.categoryId : (categories[0] ? categories[0].id : ''));
  const [startDate, setStartDate] = useState(plan ? plan.startDate : todayIso());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isValid = description.trim().length > 0 && parseFloat(totalAmount) > 0 && parseFloat(installmentsCount) > 0 && !!categoryId;

  function handleNewCat(cat: NewCategory): Category {
    const created = onCreateCategory(cat);
    setCategoryId(created.id);
    return created;
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>{plan ? 'Editar plan MSI' : 'Nuevo plan MSI'}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      <div className="px-5 mt-3">
        {plan && progress && (
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Progreso</p>
              <p className="text-xs font-mono-custom" style={{ color: COLORS.text }}>{progress.installmentsPaid.toFixed(1)}/{plan.installmentsCount}</p>
            </div>
            <div className="w-full h-2 rounded-full mt-2" style={{ backgroundColor: COLORS.elevated }}>
              <div className="h-2 rounded-full" style={{ width: `${progress.pct * 100}%`, backgroundColor: progress.isPaidOff ? COLORS.income : COLORS.accent }} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: COLORS.textFaint }}>{formatMoney(progress.paid)} pagado · {formatMoney(progress.remaining)} restante</p>
          </div>
        )}

        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿Qué compraste?</p>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Laptop" className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />

        <div className="mb-3">
          <StoreInput value={store} onChange={setStore} knownStores={knownStores} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Monto total</p>
            <input type="number" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}># de MSI</p>
            {/* `step="any"`: los MSI admiten fracciones (1.5 = pagar en quincenas). */}
            <input type="number" inputMode="decimal" step="any" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
        </div>
        {parseFloat(totalAmount) > 0 && parseFloat(installmentsCount) > 0 && (
          <p className="text-xs -mt-2 mb-3" style={{ color: COLORS.textFaint }}>≈ {formatMoney(parseFloat(totalAmount) / parseFloat(installmentsCount))} por pago completo</p>
        )}

        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
        <div className="mb-3">
          <CategoryPicker categories={categories} type="expense" selectedId={categoryId} onSelect={setCategoryId} onCreate={handleNewCat} />
        </div>

        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha de compra</p>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-4" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />

        {payments && payments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textMuted }}>Pagos registrados</p>
            <div className="space-y-1.5">
              {payments.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>{formatDateLabel(t.date)}</p>
                  <p className="text-xs font-mono-custom" style={{ color: COLORS.text }}>{formatMoney(t.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 mt-2 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>
              {payments && payments.length > 0 ? 'Esto elimina el plan. Tus pagos ya registrados se quedan, solo dejan de agruparse como MSI. ¿Continuar?' : '¿Eliminar este plan de MSI?'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={onDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {plan && (
              // `aria-label` añadido al migrar: el botón solo tenía un icono, así
              // que no tenía nombre accesible — sus hermanos de `AccountFormModal`
              // y `AddTransactionSheet` sí lo tienen. Es el único cambio de
              // comportamiento del paso 5, y es aditivo.
              <button onClick={() => setConfirmDelete(true)} aria-label="Eliminar plan" className="px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={17} />
              </button>
            )}
            <button
              disabled={!isValid}
              onClick={() => onSave({ id: plan ? plan.id : undefined, description: description.trim(), store: store.trim(), totalAmount: parseFloat(totalAmount) || 0, installmentsCount: parseFloat(installmentsCount) || 1, categoryId, startDate })}
              className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
              style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
            >
              {plan ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}
