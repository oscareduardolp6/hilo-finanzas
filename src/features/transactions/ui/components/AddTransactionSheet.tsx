/* Componente de RENDERIZADO del alta/edición de movimiento. Es la pantalla más
   cargada de Hilo: tres tipos de movimiento en un solo formulario.

   El borrador (`form`) sube por props junto a `setForm` en vez de vivir en un
   `useState` local, porque `openEditSheet` lo siembra desde fuera con el
   movimiento que se está editando. Lo que sí es local es lo que no sobrevive al
   cierre: la confirmación de borrado, los dos buscadores de cuenta y
   `expenseMode` (el toggle "esto es un pago de MSI"), que se deriva del
   borrador pero el usuario puede cambiar sin tocarlo. */

import { useEffect, useMemo, useState } from 'react';
import { Layers, Link2, Trash2, X } from 'lucide-react';
import { ACCOUNT_SEARCH_THRESHOLD, COLORS } from '../../../../shared/design/tokens';
import { accountNameMatches } from '../../../../shared/domain/search';
import type {
  Account, BenefitProgram, Category, InstallmentPlan, NewBenefitProgram, NewCategory, NewInstallmentPlan,
  PlanProgress, TransactionType,
} from '../../../../shared/domain/types';
import { AccountChipSearch } from '../../../../shared/ui/account-chips';
import { BenefitProgramPicker } from '../../../../shared/ui/benefit-program-picker';
import { CategoryPicker } from '../../../../shared/ui/category-picker';
import { InstallmentPlanPicker } from '../../../../shared/ui/installment-plan-picker';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import { StoreInput } from '../../../../shared/ui/store-input';
import type { TransactionFormDraft } from '../../domain/form';

type FormUpdater = (f: TransactionFormDraft) => TransactionFormDraft;

export type AddTransactionSheetProps = {
  formType: TransactionType;
  editingId: string | null;
  form: TransactionFormDraft | null;
  setForm: (next: FormUpdater) => void;
  accounts: Account[];
  categories: Category[];
  plans: InstallmentPlan[];
  planProgress: Record<string, PlanProgress>;
  benefitPrograms: BenefitProgram[];
  knownStores: string[];
  onClose: () => void;
  onSave: (form: TransactionFormDraft) => void;
  onDelete: (id: string) => void;
  onSwitchType: (type: TransactionType) => void;
  onCreateCategory: (category: NewCategory) => Category;
  onCreatePlan: (plan: NewInstallmentPlan) => InstallmentPlan;
  onCreateBenefitProgram: (program: NewBenefitProgram) => BenefitProgram;
  desktop?: boolean;
  /** Modo privado: los montos que muestra `InstallmentPlanPicker` se ocultan. */
  hideBalances?: boolean;
};

const TYPE_META: Record<TransactionType, { label: string; color: string }> = {
  expense: { label: 'Gasto', color: COLORS.expense },
  income: { label: 'Ingreso', color: COLORS.income },
  transfer: { label: 'Transferencia', color: COLORS.accent },
};

const TYPES: TransactionType[] = ['expense', 'income', 'transfer'];

export function AddTransactionSheet({
  formType, editingId, form, setForm, accounts, categories, plans, planProgress, benefitPrograms, knownStores,
  onClose, onSave, onDelete, onSwitchType, onCreateCategory, onCreatePlan, onCreateBenefitProgram, desktop,
  hideBalances,
}: AddTransactionSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fromAccQuery, setFromAccQuery] = useState('');
  const [toAccQuery, setToAccQuery] = useState('');
  const [expenseMode, setExpenseMode] = useState(form && form.installmentPlanId ? 'msi' : 'single');
  // Al cambiar de pestaña el modo se re-deriva del borrador; dentro de la misma
  // pestaña lo manda el usuario.
  useEffect(() => {
    setExpenseMode(form && form.installmentPlanId ? 'msi' : 'single');
  }, [formType]);

  const isValid = useMemo(() => {
    if (!form) return false;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return false;
    if (formType === 'transfer') {
      // Transferir a la misma cuenta no movería nada.
      if (!form.fromAccountId || !form.toAccountId || form.fromAccountId === form.toAccountId) return false;
      if (form.taggedAsExpense) {
        if (expenseMode === 'msi') {
          if (!form.installmentPlanId) return false;
        } else if (!form.categoryId) {
          return false;
        }
      }
      return true;
    }
    if (formType === 'expense' && expenseMode === 'msi' && !form.installmentPlanId) return false;
    if (!form.accountId || !form.categoryId) return false;
    return true;
  }, [form, formType, expenseMode]);

  if (!form) return null;

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const catList = formType === 'income' ? incomeCats : expenseCats;

  function handleNewCategory(cat: NewCategory): Category {
    const created = onCreateCategory(cat);
    setForm(f => ({ ...f, categoryId: created.id }));
    return created;
  }

  function handleNewPlan(input: NewInstallmentPlan): InstallmentPlan {
    const created = onCreatePlan(input);
    setForm(f => ({
      ...f,
      installmentPlanId: created.id,
      categoryId: created.categoryId,
      description: f.description || created.description,
    }));
    return created;
  }

  /** Elegir un plan hereda su categoría y, si no hay, su descripción. */
  const selectPlan = (id: string) => {
    const p = plans.find(x => x.id === id);
    setForm(f => ({
      ...f,
      installmentPlanId: id,
      categoryId: p ? p.categoryId : f.categoryId,
      description: f.description || (p ? p.description : f.description),
    }));
  };

  const toOptions = accounts.filter(a => a.id !== form.fromAccountId);

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>
          {editingId ? `Editar ${TYPE_META[formType].label.toLowerCase()}` : 'Nuevo movimiento'}
        </p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {!editingId && (
        <div className="flex gap-2 p-1 rounded-2xl mx-5 mt-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => onSwitchType(t)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors" style={{ backgroundColor: formType === t ? TYPE_META[t].color : 'transparent', color: formType === t ? COLORS.bg : COLORS.textMuted }}>
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 mt-5 flex items-center justify-center gap-1">
        <span className="font-mono-custom text-2xl" style={{ color: COLORS.textMuted }}>$</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="bg-transparent outline-none font-mono-custom text-4xl font-bold text-center w-40"
          style={{ color: COLORS.text }}
          autoFocus
        />
      </div>
      <p className="text-center text-xs mb-1" style={{ color: COLORS.textFaint }}>MXN</p>

      {formType !== 'transfer' && (
        <div className="px-5 mt-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
          <CategoryPicker categories={catList} type={formType} selectedId={form.categoryId} onSelect={(id) => setForm(f => ({ ...f, categoryId: id }))} onCreate={handleNewCategory} />
        </div>
      )}

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>{formType === 'transfer' ? 'Desde' : 'Cuenta'}</p>
        {accounts.length > ACCOUNT_SEARCH_THRESHOLD && <AccountChipSearch value={fromAccQuery} onChange={setFromAccQuery} />}
        <div className="flex gap-2 overflow-x-auto hilo-scroll pb-1">
          {accounts.filter(a => accountNameMatches(a.name, fromAccQuery)).map(a => {
            const selId = formType === 'transfer' ? form.fromAccountId : form.accountId;
            const isSel = selId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => formType === 'transfer'
                  // Elegir origen igual al destino empuja el destino a otra cuenta.
                  ? setForm(f => ({ ...f, fromAccountId: a.id, toAccountId: f.toAccountId === a.id ? (accounts.find(x => x.id !== a.id)?.id ?? '') : f.toAccountId }))
                  : setForm(f => ({ ...f, accountId: a.id }))
                }
                className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: isSel ? a.color : COLORS.border, backgroundColor: isSel ? a.color + '22' : 'transparent', color: COLORS.text }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      {formType === 'transfer' && (
        <div className="px-5 mt-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Hacia</p>
          {toOptions.length === 0 ? (
            <p className="text-xs" style={{ color: COLORS.textFaint }}>Necesitas al menos otra cuenta para transferir. Agrega una en la pestaña Cuentas.</p>
          ) : (
            <>
              {toOptions.length > ACCOUNT_SEARCH_THRESHOLD && <AccountChipSearch value={toAccQuery} onChange={setToAccQuery} />}
              <div className="flex gap-2 overflow-x-auto hilo-scroll pb-1">
                {toOptions.filter(a => accountNameMatches(a.name, toAccQuery)).map(a => {
                  const isSel = form.toAccountId === a.id;
                  return (
                    <button key={a.id} onClick={() => setForm(f => ({ ...f, toAccountId: a.id }))} className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: isSel ? a.color : COLORS.border, backgroundColor: isSel ? a.color + '22' : 'transparent', color: COLORS.text }}>
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {formType === 'expense' && (
        <div className="px-5 mt-5">
          <button onClick={() => { const next = expenseMode === 'msi' ? 'single' : 'msi'; setExpenseMode(next); if (next === 'single') setForm(f => ({ ...f, installmentPlanId: null })); }} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <Layers size={16} style={{ color: COLORS.accent }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Vincular a un plan de MSI</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors" style={{ backgroundColor: expenseMode === 'msi' ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: expenseMode === 'msi' ? 18 : 2 }} />
            </div>
          </button>
          {expenseMode === 'msi' && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué plan de MSI pertenece este pago?</p>
              <InstallmentPlanPicker
                plans={plans}
                progress={planProgress}
                selectedId={form.installmentPlanId}
                onSelect={selectPlan}
                onCreate={handleNewPlan}
                categories={expenseCats}
                knownStores={knownStores}
                onCreateCategory={handleNewCategory}
                hideBalances={hideBalances}
              />
            </div>
          )}
        </div>
      )}

      {formType === 'transfer' && (
        <div className="px-5 mt-5">
          <button onClick={() => setForm(f => ({ ...f, taggedAsExpense: !f.taggedAsExpense }))} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <Link2 size={16} style={{ color: COLORS.accent }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Marcar como gasto</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors" style={{ backgroundColor: form.taggedAsExpense ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: form.taggedAsExpense ? 18 : 2 }} />
            </div>
          </button>
          <p className="text-xs mt-2 px-1" style={{ color: COLORS.textFaint }}>
            Actívalo si esta transferencia paga algo que ya compraste a crédito (como tu TDC) y quieres que cuente como gasto en tus reportes por categoría, aunque el dinero técnicamente siga siendo tuyo.
          </p>
          {form.taggedAsExpense && (
            <div className="mt-3">
              <div className="flex gap-2 p-1 rounded-xl mb-3" style={{ backgroundColor: COLORS.elevated }}>
                <button onClick={() => { setExpenseMode('single'); setForm(f => ({ ...f, installmentPlanId: null })); }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: expenseMode === 'single' ? COLORS.accent : 'transparent', color: expenseMode === 'single' ? COLORS.bg : COLORS.textMuted }}>
                  Gasto único
                </button>
                <button onClick={() => setExpenseMode('msi')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: expenseMode === 'msi' ? COLORS.accent : 'transparent', color: expenseMode === 'msi' ? COLORS.bg : COLORS.textMuted }}>
                  Pago de MSI
                </button>
              </div>

              {expenseMode === 'single' ? (
                <>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué categoría de gasto pertenece?</p>
                  <CategoryPicker categories={expenseCats} type="expense" selectedId={form.categoryId} onSelect={(id) => setForm(f => ({ ...f, categoryId: id }))} onCreate={handleNewCategory} />
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué plan de MSI pertenece este pago?</p>
                  <InstallmentPlanPicker
                    plans={plans}
                    progress={planProgress}
                    selectedId={form.installmentPlanId}
                    onSelect={selectPlan}
                    onCreate={handleNewPlan}
                    categories={expenseCats}
                    knownStores={knownStores}
                    onCreateCategory={handleNewCategory}
                    hideBalances={hideBalances}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 mt-5 space-y-3">
        <div>
          <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Descripción (opcional)</p>
          <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={formType === 'transfer' ? 'Ej. Crema facial (TDC)' : 'Ej. Tacos, Uber, Renta'} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
        </div>
        {/* La tienda no aplica a un pago de MSI: la tienda es la del plan. */}
        {(formType === 'expense' || (formType === 'transfer' && form.taggedAsExpense && expenseMode !== 'msi')) && (
          <StoreInput value={form.store || ''} onChange={(v) => setForm(f => ({ ...f, store: v }))} knownStores={knownStores} />
        )}
        {(formType === 'expense' || (formType === 'transfer' && form.taggedAsExpense)) && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tamaño</p>
              <input type="text" value={form.size || ''} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="Ej. 1L" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Marca</p>
              <input type="text" value={form.brand || ''} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej. Lala" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cantidad</p>
              <input type="text" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Ej. 2" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
          </div>
        )}
        {formType === 'income' && (
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Programa / promoción (opcional)</p>
            <BenefitProgramPicker
              programs={benefitPrograms}
              accounts={accounts}
              selectedId={form.benefitProgramId}
              onSelect={(id) => setForm(f => ({ ...f, benefitProgramId: id }))}
              onCreate={onCreateBenefitProgram}
            />
          </div>
        )}
        <div>
          <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha</p>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
        </div>
      </div>

      <div className="px-5 mt-6 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Eliminar este movimiento?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => editingId && onDelete(editingId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {editingId && (
              <button onClick={() => setConfirmDelete(true)} aria-label="Eliminar movimiento" className="px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={18} />
              </button>
            )}
            <button disabled={!isValid} onClick={() => onSave(form)} className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: TYPE_META[formType].color, color: COLORS.bg }}>
              {editingId ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}
