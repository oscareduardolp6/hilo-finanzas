/* Componente de RENDERIZADO del modal de Ajustes "Beneficios y promociones":
   gestión de programas (alta/edición inline, borrado) y, debajo, el resumen de
   cuánto se ha ahorrado por programa este mes y en los últimos 6 meses.

   Un solo componente en vez de un picker de lista + un sheet de edición aparte
   (como MSI): el MVP de la tarea no lo necesita, y mantiene la feature más
   chica. La edición reutiliza el mismo formulario que el alta, sembrado con el
   programa entrante. */

import { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { IconFor, ICON_CHOICES, ICONS } from '../../../../shared/design/icons';
import { CATEGORY_PALETTE, COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { Account, BenefitProgram } from '../../../../shared/domain/types';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import type { ProgramInput } from '../../application/save-program';

export type BenefitsModalProps = {
  programs: BenefitProgram[];
  accounts: Account[];
  totalsThisMonth: Record<string, number>;
  totalsLast6Months: Record<string, number>;
  editingProgram: BenefitProgram | null;
  onStartEdit: (program: BenefitProgram | null) => void;
  onSave: (input: ProgramInput) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  desktop?: boolean;
  /** Modo privado: los totales de ahorro se reemplazan por un placeholder. */
  hideBalances?: boolean;
};

export function BenefitsModal({
  programs, accounts, totalsThisMonth, totalsLast6Months, editingProgram, onStartEdit, onSave, onDelete, onClose, desktop,
  hideBalances,
}: BenefitsModalProps) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const formTarget = creatingNew ? 'new' : editingProgram;

  function closeForm() {
    setCreatingNew(false);
    onStartEdit(null);
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Beneficios y promociones</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      <div className="px-5 mt-3 pb-6">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Programas</p>

        {programs.length === 0 && !formTarget && (
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>
            Aún no tienes ninguno. Crea uno para poder etiquetar un ingreso con la promoción o tarjeta que lo generó — por ejemplo "Starbucks x Amex" o "Cupón HEB".
          </p>
        )}

        <div className="space-y-1.5 mb-3">
          {programs.map(p => {
            const Icon = IconFor(p.icon);
            const account = p.accountId ? accounts.find(a => a.id === p.accountId) : null;
            return (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <Icon size={16} style={{ color: p.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{p.name}</p>
                  {account && <p className="text-xs truncate" style={{ color: COLORS.textFaint }}>{account.name}</p>}
                </div>
                <button onClick={() => { setCreatingNew(false); onStartEdit(p); }} aria-label={`Editar ${p.name}`} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.elevated }}>
                  <Pencil size={13} style={{ color: COLORS.textMuted }} />
                </button>
                <button onClick={() => setConfirmDeleteId(p.id)} aria-label={`Eliminar ${p.name}`} className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.expenseSoft }}>
                  <Trash2 size={13} style={{ color: COLORS.expense }} />
                </button>
              </div>
            );
          })}
        </div>

        {confirmDeleteId && (
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>
              Esto elimina el programa. Los ingresos ya etiquetados se quedan, solo dejan de sumar al resumen. ¿Continuar?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); }} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        )}

        {formTarget ? (
          <ProgramForm
            key={formTarget === 'new' ? 'new' : formTarget.id}
            initial={formTarget === 'new' ? null : formTarget}
            accounts={accounts}
            onCancel={closeForm}
            onSubmit={(input) => { onSave(input); closeForm(); }}
          />
        ) : (
          <button onClick={() => { onStartEdit(null); setCreatingNew(true); }} className="w-full py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5" style={{ borderColor: COLORS.border, borderStyle: 'dashed', color: COLORS.textMuted }}>
            <Plus size={15} /> Nuevo programa
          </button>
        )}

        <p className="text-xs font-semibold mt-6 mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Resumen de ahorro</p>
        {programs.length === 0 ? (
          <p className="text-xs" style={{ color: COLORS.textFaint }}>Crea un programa y etiqueta un ingreso con él para ver aquí cuánto llevas ahorrado.</p>
        ) : (
          <div className="space-y-1.5">
            {programs.map(p => {
              const Icon = IconFor(p.icon);
              return (
                <div key={p.id} className="px-3 py-2 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={14} style={{ color: p.color }} />
                    <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{p.name}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: COLORS.textFaint }}>Este mes</span>
                    <span className="font-mono-custom" style={{ color: COLORS.income }}>{formatMoney(totalsThisMonth[p.id] || 0, hideBalances)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-0.5">
                    <span style={{ color: COLORS.textFaint }}>Últimos 6 meses</span>
                    <span className="font-mono-custom" style={{ color: COLORS.income }}>{formatMoney(totalsLast6Months[p.id] || 0, hideBalances)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}

type ProgramFormProps = {
  initial: BenefitProgram | null;
  accounts: Account[];
  onCancel: () => void;
  onSubmit: (input: ProgramInput) => void;
};

function ProgramForm({ initial, accounts, onCancel, onSubmit }: ProgramFormProps) {
  const [name, setName] = useState(initial ? initial.name : '');
  const [icon, setIcon] = useState(initial ? initial.icon : 'Gift');
  const [color, setColor] = useState(initial ? initial.color : CATEGORY_PALETTE[0]!);
  const [accountId, setAccountId] = useState<string | null>(initial ? (initial.accountId ?? null) : null);

  const isValid = name.trim().length > 0;

  function submit() {
    if (!isValid) return;
    onSubmit({ id: initial ? initial.id : undefined, name: name.trim(), icon, color, accountId });
  }

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>{initial ? 'Editar programa' : 'Nuevo programa'}</p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Ej. Starbucks x Amex"
        autoFocus
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
        style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      />
      {accounts.length > 0 && (
        <>
          <p className="text-xs mb-1.5" style={{ color: COLORS.textFaint }}>Tarjeta (opcional)</p>
          <div className="flex gap-2 flex-wrap mb-3">
            <button onClick={() => setAccountId(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: accountId === null ? COLORS.accent : COLORS.border, backgroundColor: accountId === null ? COLORS.accentSoft : 'transparent', color: COLORS.text }}>
              Ninguna
            </button>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setAccountId(a.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: accountId === a.id ? a.color : COLORS.border, backgroundColor: accountId === a.id ? a.color + '22' : 'transparent', color: COLORS.text }}>
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="text-xs mb-1.5" style={{ color: COLORS.textFaint }}>Color</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {CATEGORY_PALETTE.map(c => (
          <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${COLORS.surfaceAlt}, 0 0 0 4px ${c}` : 'none' }} />
        ))}
      </div>
      <p className="text-xs mb-1.5" style={{ color: COLORS.textFaint }}>Ícono</p>
      <div className="grid grid-cols-6 gap-1.5 mb-3" style={{ maxHeight: 128, overflowY: 'auto' }}>
        {ICON_CHOICES.map(iconName => {
          const IconOpt = ICONS[iconName]!;
          const isSel = icon === iconName;
          return (
            <button key={iconName} onClick={() => setIcon(iconName)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isSel ? color + '33' : COLORS.elevated, border: `1px solid ${isSel ? color : COLORS.border}` }}>
              <IconOpt size={14} style={{ color: isSel ? color : COLORS.textMuted }} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Cancelar</button>
        <button onClick={submit} disabled={!isValid} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: color, color: COLORS.bg }}>{initial ? 'Guardar cambios' : 'Crear'}</button>
      </div>
    </div>
  );
}
