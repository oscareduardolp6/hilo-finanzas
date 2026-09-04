/* Rejilla de categorías con alta inline. Lo comparten el formulario de
   movimiento, el de plan MSI y el picker de planes, así que vive en `shared/ui`
   y no en una feature: una feature nunca importa el `ui/` de otra.

   `onCreate` recibe la categoría SIN id y DEVUELVE la creada. Antes el
   componente llamaba `uid('cat')` él mismo, que era una fuga de capa: los ids
   los genera el caso de uso desde `deps.idGenerator`, y así son deterministas
   en test. Quien crea necesita el id de vuelta para seleccionarla. */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ICON_CHOICES, ICONS, IconFor } from '../design/icons';
import { CATEGORY_PALETTE, COLORS } from '../design/tokens';
import type { Category, CategoryType, NewCategory } from '../domain/types';

export type CategoryPickerProps = {
  categories: Category[];
  type: CategoryType;
  selectedId: string | null | undefined;
  onSelect: (id: string) => void;
  onCreate: (category: NewCategory) => Category;
};

export function CategoryPicker({ categories, type, selectedId, onSelect, onCreate }: CategoryPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('MoreHorizontal');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]!);

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), icon, color, type });
    setName('');
    setIcon('MoreHorizontal');
    setColor(CATEGORY_PALETTE[0]!);
    setCreating(false);
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {categories.map(c => {
          const Icon = IconFor(c.icon);
          const isSel = selectedId === c.id;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: isSel ? c.color : COLORS.border, backgroundColor: isSel ? c.color + '22' : 'transparent' }}>
              <Icon size={17} style={{ color: c.color }} />
              <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>{c.name}</span>
            </button>
          );
        })}
        <button onClick={() => setCreating(v => !v)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: creating ? COLORS.surfaceAlt : 'transparent' }}>
          <Plus size={17} style={{ color: COLORS.textMuted }} />
          <span className="text-xs text-center leading-tight" style={{ color: COLORS.textMuted }}>Nueva</span>
        </button>
      </div>

      {creating && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Nueva categoría</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
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
