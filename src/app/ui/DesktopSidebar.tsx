/* La barra lateral de escritorio: la misma navegación que `BottomNav`, más los
   dos accesos rápidos y Ajustes. Componente de renderizado puro. */

import { Eye, EyeOff, Plus, ScanLine, Settings } from 'lucide-react';
import { COLORS } from '../../shared/design/tokens';
import { NAV_ITEMS } from './nav';

export type DesktopSidebarProps = {
  active: string;
  onChange: (id: string) => void;
  onOpenSettings: () => void;
  onAddTransaction: () => void;
  onScanReceipt: () => void;
  /** Modo privado: oculta saldos y montos con un placeholder. */
  hideBalances: boolean;
  onToggleHideBalances: () => void;
};

export function DesktopSidebar({
  active, onChange, onOpenSettings, onAddTransaction, onScanReceipt, hideBalances, onToggleHideBalances,
}: DesktopSidebarProps) {
  return (
    <div className="w-60 shrink-0 h-full flex flex-col border-r px-4 py-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      <div className="px-2 mb-8">
        <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
      </div>
      <button onClick={onAddTransaction} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-2" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
        <Plus size={16} /> Nueva transacción
      </button>
      <button onClick={onScanReceipt} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-6" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
        <ScanLine size={16} /> Escanear ticket
      </button>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(it => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onChange(it.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: isActive ? COLORS.accentSoft : 'transparent', color: isActive ? COLORS.accent : COLORS.textMuted }}>
              <Icon size={18} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <button onClick={onToggleHideBalances} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: COLORS.textMuted }}>
        {hideBalances ? <EyeOff size={18} /> : <Eye size={18} />} {hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'}
      </button>
      <button onClick={onOpenSettings} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: COLORS.textMuted }}>
        <Settings size={18} /> Ajustes
      </button>
    </div>
  );
}
