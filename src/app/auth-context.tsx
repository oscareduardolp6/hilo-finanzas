/* Sesión de Google: la única capa que vive FUERA del store de Zustand.

   Razón: el store (y en particular `firestoreStateRepository`) necesita saber
   el `uid` de la sesión para saber qué documento leer/escribir. La sesión
   tiene que resolverse ANTES de montar `HiloStoreProvider`, no adentro — así
   que no puede ser un slice más. Es la única lectura fuera del store en toda
   la UI de features (ver `SettingsContainer`, que lee `useAuth().signOut`).

   `status === 'resolving'` reutiliza el mismo placeholder "Cargando…" que
   `AppBody` (App.tsx) pinta mientras hidrata — mismo lenguaje visual para las
   dos esperas, aunque sean pasos distintos. */

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { COLORS } from '../shared/design/tokens';
import type { AuthUser } from '../shared/domain/ports';
import type { Deps } from './dependencies';
import { LoginScreen } from './ui/LoginScreen';

export type AuthContextValue = {
  user: AuthUser;
  signOut: () => void;
};

/** Exportado (no solo `useAuth`) para que `src/test/render-feature.tsx` pueda
 *  proveer un valor fijo sin pasar por `AuthGate` — los tests de feature
 *  montan `HiloStoreProvider` directo, nunca `App`. */
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthGate>');
  return ctx;
}

type Status =
  | { kind: 'resolving' }
  | { kind: 'loggedOut' }
  | { kind: 'ready'; user: AuthUser }
  /** Config de Firebase ausente/inválida (falta `.env.local`, ver README.md).
   *  Sin este estado, `auth()` avienta dentro del efecto y React se queda en
   *  blanco sin explicar nada — peor que un mensaje claro. */
  | { kind: 'error'; message: string };

export type AuthGateProps = {
  deps: Deps;
  children: ReactNode;
};

export function AuthGate({ deps, children }: AuthGateProps) {
  const [status, setStatus] = useState<Status>({ kind: 'resolving' });
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = () => {
    setSignInError(null);
    deps.authGateway.signInWithGoogle().catch((e) => {
      setSignInError(e instanceof Error ? e.message : String(e));
    });
  };

  useEffect(() => {
    try {
      return deps.authGateway.onAuthStateChanged((user) => {
        setStatus(user ? { kind: 'ready', user } : { kind: 'loggedOut' });
      });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      return undefined;
    }
  }, [deps]);

  if (status.kind === 'resolving') {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Cargando…</p>
      </div>
    );
  }

  if (status.kind === 'error') {
    return (
      <div className="w-full h-screen flex items-center justify-center px-6" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm text-center" style={{ color: COLORS.textMuted }}>
          No se pudo conectar con Firebase.<br />Revisa la configuración en <code>.env.local</code> (ver README.md).<br />
          <span style={{ color: COLORS.textFaint }}>{status.message}</span>
        </p>
      </div>
    );
  }

  if (status.kind === 'loggedOut') {
    return <LoginScreen onSignIn={handleSignIn} error={signInError} />;
  }

  return (
    <AuthContext.Provider value={{ user: status.user, signOut: () => void deps.authGateway.signOut() }}>
      {children}
    </AuthContext.Provider>
  );
}
