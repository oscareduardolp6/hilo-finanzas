/* Selector de programa de beneficios (cashback, promoción de tarjeta, cupón de
   comercio) con alta inline, para etiquetar un ingreso. Vive en `shared/ui` por
   la misma razón que `CategoryPicker`: lo pinta `AddTransactionSheet` (feature
   `transactions`) pero habla de programas (feature `benefits`), y una feature
   no puede importar el `ui/` de otra.

   `onCreate` recibe el programa SIN id ni marcas de tiempo y devuelve el
   creado — el generador de ids es del caso de uso, no del componente, igual
   que en `CategoryPicker`. */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { IconFor, ICON_CHOICES, ICONS } from '../design/icons';
import { CATEGORY_PALETTE, COLORS } from '../design/tokens';
import type { Account, BenefitProgram, NewBenefitProgram } from '../domain/types';

export type BenefitProgramPickerProps = {
  programs: BenefitProgram[];
  accounts: Account[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  onCreate: (program: NewBenefitProgram) => BenefitProgram;
};

export function BenefitProgramPicker({ programs, accounts, selectedId, onSelect, onCreate }: BenefitProgramPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Gift');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]!);
  const [accountId, setAccountId] = useState<string | null>(null);

  function submit() {
    if (!name.trim()) return;
    const created = onCreate({ name: name.trim(), icon, color, accountId });
    onSelect(created.id);
    setName('');
    setIcon('Gift');
    setColor(CATEGORY_PALETTE[0]!);
    setAccountId(null);
    setCreating(false);
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => onSelect(null)} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl border" style={{ borderColor: !selectedId ? COLORS.accent : COLORS.border, backgroundColor: !selectedId ? COLORS.accentSoft : 'transparent' }}>
          <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>Ninguno</span>
        </button>
        {programs.map(p => {
          const Icon = IconFor(p.icon);
          const isSel = selectedId === p.id;
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: isSel ? p.color : COLORS.border, backgroundColor: isSel ? p.color + '22' : 'transparent' }}>
              <Icon size={17} style={{ color: p.color }} />
              <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>{p.name}</span>
            </button>
          );
        })}
        <button onClick={() => setCreating(v => !v)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: creating ? COLORS.surfaceAlt : 'transparent' }}>
          <Plus size={17} style={{ color: COLORS.textMuted }} />
          <span className="text-xs text-center leading-tight" style={{ color: COLORS.textMuted }}>Nuevo</span>
        </button>
      </div>

      {creating && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Nuevo programa</p>
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
            <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Cancelar</button>
            <button onClick={submit} disabled={!name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: color, color: COLORS.bg }}>Crear</button>
          </div>
        </div>
      )}
    </div>
  );
}
