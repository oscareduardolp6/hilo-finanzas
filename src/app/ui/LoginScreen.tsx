/* Componente de RENDERIZADO: solo el botón de Google. Sin store — `AuthGate`
   todavía no monta `HiloStoreProvider` en este punto. */

import { LogIn } from 'lucide-react';
import { COLORS } from '../../shared/design/tokens';

export type LoginScreenProps = {
  onSignIn: () => void;
  error?: string | null;
};

export function LoginScreen({ onSignIn, error }: LoginScreenProps) {
  return (
    <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
      <div className="text-center px-6">
        <h1 className="text-xl font-semibold font-display mb-1" style={{ color: COLORS.text }}>Hilo</h1>
        <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>Inicia sesión para ver tus datos.</p>
        <button
          onClick={onSignIn}
          className="px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 mx-auto"
          style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
        >
          <LogIn size={16} /> Iniciar sesión con Google
        </button>
        {error && (
          <p className="text-xs mt-4 max-w-xs mx-auto" style={{ color: COLORS.textFaint }}>{error}</p>
        )}
      </div>
    </div>
  );
}
