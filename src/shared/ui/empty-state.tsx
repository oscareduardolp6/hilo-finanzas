/* El hueco cuando una lista viene vacía. Lo usan Inicio, el historial y MSI. */

import { Receipt } from 'lucide-react';
import { COLORS } from '../design/tokens';

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <Receipt size={18} style={{ color: COLORS.textFaint }} />
      </div>
      <p className="text-sm" style={{ color: COLORS.textMuted }}>{text}</p>
    </div>
  );
}
