/* Componente de RENDERIZADO: el formulario de alta/edición de cuenta.

   Conserva su `useState` local a propósito (plan §7): es un BORRADOR de UI, no
   dominio. Subirlo al store haría que cada tecla persistiera en IndexedDB y que
   cerrar el modal sin guardar dejara basura. El valor solo cruza la frontera al
   pulsar "Guardar": `onSave` recibe un `AccountInput` ya limpio. */

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { ACCOUNT_TYPES } from '../../../../shared/design/icons';
import { CATEGORY_PALETTE, COLORS } from '../../../../shared/design/tokens';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import type { Account, AccountTypeId } from '../../../../shared/domain/types';
import type { AccountInput } from '../../application/save-account';

export type AccountFormModalProps = {
  /** `null` = alta. */
  account: Account | null;
  /** Falso si la cuenta tiene movimientos: borrarla dejaría huérfanos. */
  canDelete: boolean;
  onClose: () => void;
  onSave: (input: AccountInput) => void;
  onDelete: () => void;
  desktop?: boolean;
};

export function AccountFormModal({ account, canDelete, onClose, onSave, onDelete, desktop }: AccountFormModalProps) {
  const [name, setName] = useState(account ? account.name : '');
  const [type, setType] = useState<AccountTypeId>(account ? account.type : 'debito');
  const [color, setColor] = useState(account ? account.color : CATEGORY_PALETTE[0]!);
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initialBalance) : '0');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isValid = name.trim().length > 0;

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>{account ? 'Editar cuenta' : 'Nueva cuenta'}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      <div className="px-5 mt-3">
        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Nombre</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. NU, Mercado Pago, Efectivo" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tipo de cuenta</p>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map(t => {
            const Icon = t.icon;
            const isSel = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: isSel ? color : COLORS.border, backgroundColor: isSel ? color + '22' : 'transparent' }}>
                <Icon size={16} style={{ color: isSel ? color : COLORS.textMuted }} />
                <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Color</p>
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${COLORS.bg}, 0 0 0 4px ${c}` : 'none' }} />
          ))}
        </div>
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Saldo inicial</p>
        <input type="number" inputMode="decimal" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
      </div>

      <div className="px-5 mt-6 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Eliminar esta cuenta?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={onDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {account && (
              <button onClick={() => canDelete && setConfirmDelete(true)} disabled={!canDelete} aria-label="Eliminar cuenta" className="px-4 py-3 rounded-xl disabled:opacity-30" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={17} />
              </button>
            )}
            <button disabled={!isValid} onClick={() => onSave({ id: account ? account.id : undefined, name: name.trim(), type, color, initialBalance: parseFloat(initialBalance) || 0 })} className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
              {account ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
          </div>
        )}
        {!canDelete && account && !confirmDelete && (
          <p className="mt-2 text-xs" style={{ color: COLORS.textFaint }}>Esta cuenta tiene movimientos registrados, así que no se puede eliminar.</p>
        )}
      </div>
    </SheetOverlay>
  );
}
