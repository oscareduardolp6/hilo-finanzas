/* La raíz de Hilo. Después del refactor son 30 líneas: monta el store, espera a
   la hidratación y elige uno de los dos árboles.

   El store se construye POR MONTAJE (ver `store-context.tsx`), así que cada
   `render(<App/>)` arranca limpio — la misma semántica que cuando el estado
   vivía en los 29 `useState` de este componente. */

import { COLORS } from '../shared/design/tokens';
import { useIsDesktop } from '../shared/ui/use-is-desktop';
import { HiloStoreProvider, useHiloStore } from './store-context';
import { useToastAutoDismiss } from './use-toast-auto-dismiss';
import { DesktopShell, MobileShell } from './ui/Shells';

export default function App() {
  return (
    <HiloStoreProvider>
      <AppBody />
    </HiloStoreProvider>
  );
}

function AppBody() {
  const loaded = useHiloStore((s) => s.loaded);
  const isDesktop = useIsDesktop();

  /* La hidratación y el guardado automático los lleva el Provider
     (`persistence.ts`). Aquí solo queda el auto-cierre del toast, que es puro
     asunto de UI. */
  useToastAutoDismiss();

  if (!loaded) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Cargando…</p>
      </div>
    );
  }

  return isDesktop ? <DesktopShell /> : <MobileShell />;
}
