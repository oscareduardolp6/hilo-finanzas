/* Componente de RENDERIZADO de Ajustes: props → JSX.

   Conserva estado de BORRADOR —la key y el modelo mientras se escriben, y el
   "¿seguro?" de borrar movimientos—, que es lo mismo que hacen las otras hojas
   con formulario. Nada de eso es dominio. También el resultado de "Probar
   clave", que solo dice algo de lo que está escrito ahora mismo. */

import { useState } from 'react';
import { DatabaseBackup, Eye, EyeOff, Gift, LogIn, LogOut, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import type { OcrSettings } from '../../../../shared/domain/types';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import { RECEIPT_MODEL_DEFAULT } from '../../../receipt-ocr/domain/config';

export type SettingsModalProps = {
  ocrSettings: OcrSettings;
  onSaveOcrSettings: (settings: OcrSettings) => void;
  /** "Probar clave": la key y el modelo escritos, aún sin guardar. */
  onVerifyOcrSettings: (apiKey: string, model: string) => Promise<{ ok: boolean; message?: string }>;
  onResetTransactions: () => void;
  onOpenImport: () => void;
  onOpenBackup: () => void;
  onOpenBenefits: () => void;
  /** Sin sesión la app corre en modo local: se ofrece iniciar sesión en vez de cerrarla. */
  signedIn: boolean;
  signInError?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function SettingsModal({
  ocrSettings, onSaveOcrSettings, onVerifyOcrSettings, onResetTransactions,
  onOpenImport, onOpenBackup, onOpenBenefits, signedIn, signInError, onSignIn, onSignOut, onClose, desktop,
}: SettingsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [keyDraft, setKeyDraft] = useState((ocrSettings && ocrSettings.apiKey) || '');
  const [modelDraft, setModelDraft] = useState((ocrSettings && ocrSettings.model) || '');
  const savedKey = (ocrSettings && ocrSettings.apiKey) || '';
  // Se enseñan los últimos 4 para que se reconozca cuál es, sin exponerla.
  const maskedKey = savedKey ? `•••• ${savedKey.slice(-4)}` : null;
  const [showKey, setShowKey] = useState(false);
  const [verify, setVerify] = useState<{ state: 'idle' | 'checking' | 'ok' | 'error'; message?: string }>({ state: 'idle' });
  const editKey = (next: string) => { setKeyDraft(next); setVerify({ state: 'idle' }); };
  const editModel = (next: string) => { setModelDraft(next); setVerify({ state: 'idle' }); };
  async function handleVerify() {
    setVerify({ state: 'checking' });
    const outcome = await onVerifyOcrSettings(keyDraft, modelDraft);
    setVerify(outcome.ok ? { state: 'ok' } : { state: 'error', message: outcome.message });
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Ajustes</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <div className="px-5 mt-3 pb-6">
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium" style={{ color: COLORS.text }}>Moneda</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>Pesos mexicanos (MXN)</p>
        </div>
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Sobre la trazabilidad</p>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>Cuando marcas una transferencia como gasto, el monto cuenta en tus reportes por categoría, pero no resta de tu saldo total: el dinero sigue siendo tuyo hasta que de verdad pagas la tarjeta de crédito.</p>
        </div>
        <button onClick={onOpenBackup} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <DatabaseBackup size={15} /> Respaldo de datos
        </button>
        <button onClick={onOpenBenefits} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <Gift size={15} /> Beneficios y promociones
        </button>
        <button onClick={onOpenImport} className="w-full py-3 rounded-xl text-sm font-semibold mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Importar desde Monefy</button>
        {signedIn ? (
          <button onClick={onSignOut} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        ) : (
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Modo local</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
              Estás usando Hilo sin cuenta: tus datos viven solo en este navegador. Inicia sesión con Google para guardarlos en la nube y verlos en tus otros dispositivos.
            </p>
            <button onClick={onSignIn} className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
              <LogIn size={15} /> Iniciar sesión con Google
            </button>
            {signInError && (
              <p className="text-xs mt-2" style={{ color: COLORS.textFaint }}>{signInError}</p>
            )}
          </div>
        )}

        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Escaneo de tickets (IA)</p>
          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
            La key se guarda solo en este dispositivo y se envía directo a Anthropic junto con la foto del ticket. No se incluye en la sincronización ni en los respaldos. Usa una key dedicada para Hilo con un límite de gasto mensual: {' '}
            <span style={{ color: COLORS.textFaint }}>console.anthropic.com/settings/keys</span>
          </p>
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>API key {maskedKey ? `· guardada (${maskedKey})` : ''}</p>
          {/* Texto enmascarado y no `type="password"`: en un campo de
              contraseña el gestor del navegador (Chrome Android) puede
              autollenar una contraseña guardada encima de la key, u ofrecer
              guardarla como contraseña. El ojo deja ver lo que se pegó. */}
          <div className="relative mb-2">
            <input
              type="text"
              name="hilo-anthropic-api-key"
              value={keyDraft}
              onChange={e => editKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              aria-label="API key de Anthropic"
              className="w-full pl-3 pr-10 py-2 rounded-lg text-sm outline-none font-mono-custom"
              style={{
                backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}`,
                ...(showKey ? {} : { WebkitTextSecurity: 'disc' }),
              } as React.CSSProperties}
            />
            <button onClick={() => setShowKey(v => !v)} aria-label={showKey ? 'Ocultar key' : 'Mostrar key'} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center">
              {showKey ? <EyeOff size={15} style={{ color: COLORS.textMuted }} /> : <Eye size={15} style={{ color: COLORS.textMuted }} />}
            </button>
          </div>
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>Modelo</p>
          <input
            type="text"
            value={modelDraft}
            onChange={e => editModel(e.target.value)}
            placeholder={RECEIPT_MODEL_DEFAULT}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Déjalo vacío para usar el modelo por defecto (Haiku 5.5: el más barato, y lee bien la letra chica). Puedes poner otro id si quieres más precisión.</p>
          {verify.state !== 'idle' && (
            <p className="text-xs mb-2" style={{ color: verify.state === 'error' ? COLORS.expense : verify.state === 'ok' ? COLORS.income : COLORS.textMuted }}>
              {verify.state === 'checking' && 'Comprobando…'}
              {verify.state === 'ok' && 'Clave válida · modelo disponible.'}
              {verify.state === 'error' && verify.message}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => void handleVerify()} disabled={!keyDraft.trim() || verify.state === 'checking'} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Probar clave</button>
            <button onClick={() => onSaveOcrSettings({ apiKey: keyDraft.trim(), model: modelDraft.trim() })} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>Guardar</button>
            {savedKey && (
              <button onClick={() => { setKeyDraft(''); setModelDraft(''); onSaveOcrSettings({ apiKey: '', model: '' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Quitar</button>
            )}
          </div>
        </div>

        {!confirmingReset ? (
          <button onClick={() => setConfirmingReset(true)} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>Borrar todos los movimientos</button>
        ) : (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Seguro? Se borrarán todos tus movimientos (tus cuentas se quedan).</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingReset(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => { onResetTransactions(); setConfirmingReset(false); onClose(); }} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Sí, borrar</button>
            </div>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}
