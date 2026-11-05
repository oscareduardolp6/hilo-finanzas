/* Componente de RENDERIZADO del desglose de un ticket, dentro de
   `AddTransactionSheet`.

   El total del movimiento (el input grande de la hoja) es la fuente de la
   verdad: aquí solo se reparte. Lo que no se desglosa aparece como renglón
   "Sin especificar", de solo lectura, y baja conforme se agregan conceptos.

   Lo único local es qué tarjeta está abierta: una a la vez, para que un ticket
   de 15 renglones no sea una pared de inputs. La recién agregada se abre sola. */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Tag, Trash2 } from 'lucide-react';
import { IconFor } from '../../../../shared/design/icons';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { Account, BenefitProgram, Category, NewBenefitProgram } from '../../../../shared/domain/types';
import { BenefitProgramPicker } from '../../../../shared/ui/benefit-program-picker';
import { patchItemDraft } from '../../domain/breakdown';
import type {
  BreakdownDiscountDraft, BreakdownDraft, BreakdownItemDraft, BreakdownSummary,
} from '../../domain/breakdown';

export type BreakdownEditorProps = {
  breakdown: BreakdownDraft;
  summary: BreakdownSummary;
  /** La categoría del movimiento: la heredan los renglones sin categoría propia. */
  parentCategory: Category | undefined;
  expenseCategories: Category[];
  benefitPrograms: BenefitProgram[];
  accounts: Account[];
  onChange: (next: BreakdownDraft) => void;
  onAddItem: () => void;
  onAddDiscount: () => void;
  onCreateBenefitProgram: (program: NewBenefitProgram) => BenefitProgram;
};

const inputStyle = { backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` };
const inputClass = 'w-full px-2.5 py-1.5 rounded-lg text-sm outline-none';
const labelClass = 'text-[10px] font-semibold mb-1 uppercase tracking-wide';

const toNumber = (v: string): number => parseFloat(v) || 0;

/** Fila de chips de categoría: "Del movimiento" (hereda) + las de gasto. */
function CategoryChips({ categories, selectedId, parent, onSelect }: {
  categories: Category[];
  selectedId: string | null;
  parent: Category | undefined;
  onSelect: (id: string | null) => void;
}) {
  // El elegido puede estar lejos a la derecha: se desplaza la fila (solo en
  // horizontal, sin mover la hoja) para que se vea al abrir la tarjeta.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const sel = row?.querySelector<HTMLElement>('[data-selected="true"]');
    if (row && sel) row.scrollLeft = Math.max(0, sel.offsetLeft - row.offsetLeft - 8);
  }, [selectedId]);
  return (
    <div ref={rowRef} className="flex gap-1.5 overflow-x-auto hilo-scroll pb-1">
      <button onClick={() => onSelect(null)} className="shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: !selectedId ? COLORS.accent : COLORS.border, backgroundColor: !selectedId ? COLORS.accentSoft : 'transparent', color: COLORS.text }}>
        {parent ? `Como el movimiento (${parent.name})` : 'Como el movimiento'}
      </button>
      {categories.map(c => {
        const isSel = selectedId === c.id;
        return (
          <button key={c.id} data-selected={isSel} onClick={() => onSelect(c.id)} className="shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium" style={{ borderColor: isSel ? c.color : COLORS.border, backgroundColor: isSel ? c.color + '22' : 'transparent', color: COLORS.text }}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function BreakdownEditor({
  breakdown, summary, parentCategory, expenseCategories, benefitPrograms, accounts,
  onChange, onAddItem, onAddDiscount, onCreateBenefitProgram,
}: BreakdownEditorProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  // La línea recién agregada se abre sola (su id lo pone el store, así que se
  // detecta por crecimiento de la lista).
  const prev = useRef({ items: breakdown.items.length, discounts: breakdown.discounts.length });
  useEffect(() => {
    if (breakdown.items.length > prev.current.items) setOpenId(breakdown.items[breakdown.items.length - 1]!.id);
    else if (breakdown.discounts.length > prev.current.discounts) setOpenId(breakdown.discounts[breakdown.discounts.length - 1]!.id);
    prev.current = { items: breakdown.items.length, discounts: breakdown.discounts.length };
  }, [breakdown.items, breakdown.discounts]);

  const catById = (id: string | null) => (id ? expenseCategories.find(c => c.id === id) : undefined) || parentCategory;

  const patchItem = (id: string, fn: (i: BreakdownItemDraft) => BreakdownItemDraft) =>
    onChange({ ...breakdown, items: breakdown.items.map(i => i.id === id ? fn(i) : i) });
  const patchDiscount = (id: string, patch: Partial<BreakdownDiscountDraft>) =>
    onChange({ ...breakdown, discounts: breakdown.discounts.map(d => d.id === id ? { ...d, ...patch } : d) });
  const toggle = (id: string) => setOpenId(o => (o === id ? null : id));

  const ParentIcon = IconFor(parentCategory ? parentCategory.icon : null);

  return (
    <div className="mt-3 space-y-2">
      {breakdown.items.map(item => {
        const cat = catById(item.categoryId);
        const Icon = IconFor(cat ? cat.icon : null);
        const open = openId === item.id;
        return (
          <div key={item.id} className="rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt, border: `1px solid ${open ? COLORS.accent : COLORS.border}` }}>
            <button onClick={() => toggle(item.id)} aria-label={`Editar concepto ${item.description || 'sin nombre'}`} className="w-full flex items-center gap-2 px-3 py-2 text-left">
              <Icon size={14} style={{ color: cat ? cat.color : COLORS.textMuted }} />
              <span className="flex-1 truncate text-sm" style={{ color: item.description ? COLORS.text : COLORS.textFaint }}>
                {item.description || 'Concepto sin nombre'}
                {item.quantity ? <span style={{ color: COLORS.textMuted }}> · {item.quantity} ×</span> : null}
              </span>
              <span className="font-mono-custom text-sm" style={{ color: COLORS.text }}>{formatMoney(toNumber(item.amount))}</span>
              {open ? <ChevronUp size={14} style={{ color: COLORS.textMuted }} /> : <ChevronDown size={14} style={{ color: COLORS.textMuted }} />}
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Concepto</p>
                    <input type="text" value={item.description} onChange={e => patchItem(item.id, i => ({ ...i, description: e.target.value }))} placeholder="Ej. Nigiris" className={inputClass} style={inputStyle} />
                  </div>
                  <button onClick={() => onChange({ ...breakdown, items: breakdown.items.filter(i => i.id !== item.id) })} aria-label="Quitar concepto" className="px-2.5 py-2 rounded-lg" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Cantidad</p>
                    <input type="number" inputMode="decimal" aria-label="Cantidad del concepto" value={item.quantity} onChange={e => patchItem(item.id, i => patchItemDraft(i, 'quantity', e.target.value))} placeholder="1" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Precio unit.</p>
                    <input type="number" inputMode="decimal" aria-label="Precio unitario del concepto" value={item.unitPrice} onChange={e => patchItem(item.id, i => patchItemDraft(i, 'unitPrice', e.target.value))} placeholder="0.00" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Total</p>
                    <input type="number" inputMode="decimal" aria-label="Total del concepto" value={item.amount} onChange={e => patchItem(item.id, i => patchItemDraft(i, 'amount', e.target.value))} placeholder="0.00" className={inputClass} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <p className={labelClass} style={{ color: COLORS.textMuted }}>Categoría</p>
                  <CategoryChips categories={expenseCategories} selectedId={item.categoryId} parent={parentCategory} onSelect={(id) => patchItem(item.id, i => ({ ...i, categoryId: id }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Tamaño</p>
                    <input type="text" value={item.size} onChange={e => patchItem(item.id, i => ({ ...i, size: e.target.value }))} placeholder="Ej. 1L" className={inputClass} style={inputStyle} />
                  </div>
                  <div>
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Marca</p>
                    <input type="text" value={item.brand} onChange={e => patchItem(item.id, i => ({ ...i, brand: e.target.value }))} placeholder="Ej. Lala" className={inputClass} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {summary.unspecified > 0.005 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: `1px dashed ${COLORS.border}` }}>
          <ParentIcon size={14} style={{ color: parentCategory ? parentCategory.color : COLORS.textMuted }} />
          <span className="flex-1 text-sm" style={{ color: COLORS.textMuted }}>Sin especificar{parentCategory ? ` · ${parentCategory.name}` : ''}</span>
          <span className="font-mono-custom text-sm" style={{ color: COLORS.textMuted }}>{formatMoney(summary.unspecified)}</span>
        </div>
      )}

      {breakdown.discounts.map(d => {
        const open = openId === d.id;
        const program = d.benefitProgramId ? benefitPrograms.find(p => p.id === d.benefitProgramId) : undefined;
        return (
          <div key={d.id} className="rounded-xl" style={{ backgroundColor: COLORS.incomeSoft, border: `1px solid ${open ? COLORS.income : COLORS.border}` }}>
            <button onClick={() => toggle(d.id)} aria-label={`Editar descuento ${d.label || 'sin nombre'}`} className="w-full flex items-center gap-2 px-3 py-2 text-left">
              <Tag size={14} style={{ color: COLORS.income }} />
              <span className="flex-1 truncate text-sm" style={{ color: COLORS.text }}>
                {d.label || 'Descuento'}
                {program ? <span style={{ color: COLORS.textMuted }}> · {program.name}</span> : null}
              </span>
              <span className="font-mono-custom text-sm" style={{ color: COLORS.income }}>-{formatMoney(toNumber(d.amount))}</span>
              {open ? <ChevronUp size={14} style={{ color: COLORS.textMuted }} /> : <ChevronDown size={14} style={{ color: COLORS.textMuted }} />}
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Concepto</p>
                    <input type="text" value={d.label} onChange={e => patchDiscount(d.id, { label: e.target.value })} placeholder="Ej. Promoción Amex" className={inputClass} style={inputStyle} />
                  </div>
                  <div className="w-24">
                    <p className={labelClass} style={{ color: COLORS.textMuted }}>Monto</p>
                    <input type="number" inputMode="decimal" aria-label="Monto del descuento" value={d.amount} onChange={e => patchDiscount(d.id, { amount: e.target.value })} placeholder="0.00" className={inputClass} style={inputStyle} />
                  </div>
                  <button onClick={() => onChange({ ...breakdown, discounts: breakdown.discounts.filter(x => x.id !== d.id) })} aria-label="Quitar descuento" className="px-2.5 py-2 rounded-lg" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div>
                  <p className={labelClass} style={{ color: COLORS.textMuted }}>Resta del gasto de</p>
                  <CategoryChips categories={expenseCategories} selectedId={d.categoryId} parent={parentCategory} onSelect={(id) => patchDiscount(d.id, { categoryId: id })} />
                </div>
                <div>
                  <p className={labelClass} style={{ color: COLORS.textMuted }}>Programa / promoción (opcional)</p>
                  <BenefitProgramPicker
                    programs={benefitPrograms}
                    accounts={accounts}
                    selectedId={d.benefitProgramId}
                    onSelect={(id) => patchDiscount(d.id, { benefitProgramId: id })}
                    onCreate={onCreateBenefitProgram}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-2">
        <button onClick={onAddItem} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor: COLORS.border, borderStyle: 'dashed', color: COLORS.text }}>
          <Plus size={13} /> Agregar concepto
        </button>
        <button onClick={onAddDiscount} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor: COLORS.border, borderStyle: 'dashed', color: COLORS.income }}>
          <Plus size={13} /> Agregar descuento
        </button>
      </div>

      <div className="rounded-xl px-3 py-2 space-y-1 text-xs" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <div className="flex justify-between" style={{ color: COLORS.textMuted }}>
          <span>Subtotal</span><span className="font-mono-custom">{formatMoney(summary.subtotal)}</span>
        </div>
        {summary.discountsTotal > 0 && (
          <div className="flex justify-between" style={{ color: COLORS.income }}>
            <span>Ahorro en descuentos</span><span className="font-mono-custom">-{formatMoney(summary.discountsTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold" style={{ color: COLORS.text }}>
          <span>Total pagado</span><span className="font-mono-custom">{formatMoney(summary.subtotal - summary.discountsTotal)}</span>
        </div>
      </div>

      {!summary.isBalanced && (
        <p role="alert" className="text-xs px-1" style={{ color: COLORS.expense }}>
          Los conceptos suman {formatMoney(-summary.unspecified)} más que el total. Ajusta el total o los conceptos.
        </p>
      )}
    </div>
  );
}
