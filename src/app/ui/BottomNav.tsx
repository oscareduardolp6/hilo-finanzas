/* La navegación de móvil. Componente de renderizado puro: recibe la pestaña
   activa y avisa del cambio. */

import { COLORS } from '../../shared/design/tokens';
import { NAV_ITEMS } from './nav';

export type BottomNavProps = {
  active: string;
  onChange: (id: string) => void;
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className="flex items-center justify-around border-t px-1 py-2 shrink-0" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      {NAV_ITEMS.map(it => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl">
            <Icon size={20} style={{ color: isActive ? COLORS.accent : COLORS.textMuted }} />
            <span className="text-xs font-medium" style={{ color: isActive ? COLORS.accent : COLORS.textMuted }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
