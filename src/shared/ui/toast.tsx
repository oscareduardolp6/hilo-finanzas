/* El aviso de "ya está". En móvil baja desde arriba dentro del marco del
   teléfono; en escritorio se queda en la esquina inferior derecha — el mismo
   patrón de `SheetOverlay`, un solo prop `desktop` decide. */

import { Check } from 'lucide-react';
import { COLORS } from '../design/tokens';

export type ToastProps = {
  message: string;
  desktop?: boolean;
};

export function Toast({ message, desktop }: ToastProps) {
  const className = desktop
    ? 'fixed z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2'
    : 'absolute left-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2';
  const style = desktop
    ? { bottom: 24, right: 24, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` }
    : { top: 16, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` };
  return (
    <div className={className} style={style}>
      <Check size={15} style={{ color: COLORS.income }} />
      <span className="text-sm" style={{ color: COLORS.text }}>{message}</span>
    </div>
  );
}
