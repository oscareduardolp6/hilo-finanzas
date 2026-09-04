/* El caparazón de todos los modales de Hilo.

   En móvil es una hoja que sube desde abajo (`absolute`, dentro del marco del
   teléfono); en escritorio, un diálogo centrado (`fixed`). Los 9 modales solo
   reenvían el prop `desktop` — ninguno decide su propio posicionamiento.

   Vive en `shared/ui` y no en una feature porque lo usan todas. */

import type { ReactNode } from 'react';
import { COLORS } from '../design/tokens';

export type SheetOverlayProps = {
  onClose: () => void;
  children: ReactNode;
  desktop?: boolean;
};

export function SheetOverlay({ onClose, children, desktop }: SheetOverlayProps) {
  if (desktop) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center hilo-overlay p-6" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
        <div className="hilo-sheet rounded-3xl overflow-y-auto hilo-scroll w-full max-w-lg" style={{ backgroundColor: COLORS.surface, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end hilo-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="hilo-sheet rounded-t-3xl overflow-y-auto hilo-scroll" style={{ backgroundColor: COLORS.surface, maxHeight: '88%' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
