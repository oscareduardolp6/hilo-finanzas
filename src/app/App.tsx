/* La raíz de Hilo: resuelve la sesión de Google, monta el store, espera a la
   hidratación y elige uno de los dos árboles.

   El store se construye POR MONTAJE (ver `store-context.tsx`), así que cada
   `render(<App/>)` arranca limpio — la misma semántica que cuando el estado
   vivía en los 29 `useState` de este componente.

   `deps` es una prop opcional — igual que ya lo era en `HiloStoreProvider` —
   para poder inyectar un `authGateway`/`stateRepository` de mentira en test
   (ver `test/integration/helpers.jsx`), sin que producción tenga que pasar
   nada. */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { COLORS } from '../shared/design/tokens';
import { useIsDesktop } from '../shared/ui/use-is-desktop';
import { AuthGate, useAuth } from './auth-context';
import { localDeps, productionDeps } from './dependencies';
import type { Deps } from './dependencies';
import { HiloStoreProvider, useHiloStore } from './store-context';
import { useToastAutoDismiss } from './use-toast-auto-dismiss';
import { DesktopShell, MobileShell } from './ui/Shells';

export type AppProps = {
  deps?: Deps;
};

export default function App({ deps = productionDeps }: AppProps = {}) {
  return (
    <AuthGate deps={deps}>
      <SessionStore deps={deps}>
        <AppBody />
      </SessionStore>
    </AuthGate>
  );
}

/* Con sesión, el store habla con Firestore; sin ella, con el IndexedDB local.
   El `key` fuerza un store nuevo al iniciar/cerrar sesión: cada uno hidrata de
   su propia fuente y no se arrastra estado de la otra. */
function SessionStore({ deps, children }: { deps: Deps; children: ReactNode }) {
  const { user } = useAuth();
  const sessionDeps = useMemo(() => (user ? deps : localDeps(deps)), [user, deps]);
  return (
    <HiloStoreProvider key={user?.uid ?? 'local'} deps={sessionDeps}>
      {children}
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
