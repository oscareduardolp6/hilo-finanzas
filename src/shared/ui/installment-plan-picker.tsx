/* Selector de plan MSI con alta inline, para vincular un pago a un plan.

   Vive en `shared/ui` por la misma razón que `CategoryPicker`: lo pinta el
   formulario de movimiento (feature `transactions`) pero habla de planes
   (feature `installments`), y una feature no puede importar el `ui/` de otra.
   Es presentacional: todo entra por props.

   `onCreate` recibe el plan SIN id ni marcas de tiempo y devuelve el creado —
   el generador de ids es del caso de uso, no del componente. */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { COLORS } from '../design/tokens';
import { todayIso } from '../domain/dates';
import { formatMoney } from '../domain/money';
import type { Category, InstallmentPlan, NewCategory, NewInstallmentPlan } from '../domain/types';
import { CategoryPicker } from './category-picker';
import { StoreInput } from './store-input';

/** Lo que el picker necesita saber del avance de un plan. Se define aquí, en
 *  términos de lo que pinta, para no depender de la feature `installments`. */
export type PlanProgress = {
  paid: number;
  installmentsPaid: number;
  remaining: number;
  pct: number;
  isPaidOff?: boolean;
};

export type InstallmentPlanPickerProps = {
  plans: InstallmentPlan[];
  progress: Record<string, PlanProgress>;
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
  onCreate: (plan: NewInstallmentPlan) => InstallmentPlan;
  categories: Category[];
  knownStores: string[];
  onCreateCategory: (category: NewCategory) => Category;
};

export function InstallmentPlanPicker({
  plans, progress, selectedId, onSelect, onCreate, categories, knownStores, onCreateCategory,
}: InstallmentPlanPickerProps) {
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('6');
  const [categoryId, setCategoryId] = useState(categories[0] ? categories[0].id : '');
  const [startDate, setStartDate] = useState(todayIso());

  // Un plan ya liquidado no se ofrece: no hay nada más que abonarle.
  const activePlans = plans.filter(p => !(progress[p.id] && progress[p.id]!.isPaidOff));

  function handleNewCat(cat: NewCategory): Category {
    const created = onCreateCategory(cat);
    setCategoryId(created.id);
    return created;
  }

  const submitValid = !!(description.trim() && parseFloat(totalAmount) > 0 && parseFloat(installmentsCount) > 0 && categoryId);

  function submit() {
    if (!submitValid) return;
    onCreate({
      description: description.trim(),
      store: store.trim(),
      totalAmount: parseFloat(totalAmount),
      // `parseFloat`, no `parseInt`: admite fracciones (1.5 = pagar en quincenas).
      installmentsCount: parseFloat(installmentsCount),
      categoryId,
      startDate,
    });
    setCreating(false);
    setDescription('');
    setStore('');
    setTotalAmount('');
    setInstallmentsCount('6');
  }

  return (
    <div>
      {activePlans.length > 0 && (
        <div className="space-y-2 mb-2">
          {activePlans.map(p => {
            const prog = progress[p.id] || { paid: 0, installmentsPaid: 0, remaining: p.totalAmount, pct: 0 };
            const isSel = selectedId === p.id;
            return (
              <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left p-3 rounded-xl border" style={{ borderColor: isSel ? COLORS.accent : COLORS.border, backgroundColor: isSel ? COLORS.accentSoft : COLORS.surfaceAlt }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{p.description}{p.store ? ` · ${p.store}` : ''}</p>
                  <p className="text-xs font-mono-custom shrink-0" style={{ color: COLORS.textMuted }}>{prog.installmentsPaid.toFixed(1)}/{p.installmentsCount}</p>
                </div>
                <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: COLORS.elevated }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${prog.pct * 100}%`, backgroundColor: COLORS.accent }} />
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.textFaint }}>Quedan {formatMoney(prog.remaining)}</p>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => setCreating(v => !v)} className="w-full py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5" style={{ borderColor: COLORS.border, borderStyle: 'dashed', color: COLORS.textMuted, backgroundColor: creating ? COLORS.surfaceAlt : 'transparent' }}>
        <Plus size={15} /> Nuevo plan de MSI
      </button>

      {creating && (
        <div className="mt-3 rounded-xl p-3 space-y-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿Qué compraste?</p>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Laptop" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
          <StoreInput value={store} onChange={setStore} knownStores={knownStores} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Monto total</p>
              <input type="number" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}># de MSI</p>
              <input type="number" inputMode="decimal" step="any" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} placeholder="6" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
          </div>
          {parseFloat(totalAmount) > 0 && parseFloat(installmentsCount) > 0 && (
            <p className="text-xs" style={{ color: COLORS.textFaint }}>≈ {formatMoney(parseFloat(totalAmount) / parseFloat(installmentsCount))} por pago completo</p>
          )}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
            <CategoryPicker categories={categories} type="expense" selectedId={categoryId} onSelect={setCategoryId} onCreate={handleNewCat} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha de compra</p>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Cancelar</button>
            <button onClick={submit} disabled={!submitValid} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>Crear plan</button>
          </div>
        </div>
      )}
    </div>
  );
}
