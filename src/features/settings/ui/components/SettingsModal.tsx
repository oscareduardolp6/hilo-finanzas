/* Componente de RENDERIZADO de Ajustes: props → JSX.

   Conserva estado de BORRADOR —la key y el modelo mientras se escriben, y el
   "¿seguro?" de borrar movimientos—, que es lo mismo que hacen las otras hojas
   con formulario. Nada de eso es dominio. */

import { useState } from 'react';
import { DatabaseBackup, Gift, RefreshCw, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import type { OcrSettings } from '../../../../shared/domain/types';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import { RECEIPT_MODEL_DEFAULT } from '../../../receipt-ocr/domain/config';

export type SettingsModalProps = {
  ocrSettings: OcrSettings;
  onSaveOcrSettings: (settings: OcrSettings) => void;
  onResetTransactions: () => void;
  onOpenImport: () => void;
  onOpenSync: () => void;
  onOpenBackup: () => void;
  onOpenBenefits: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function SettingsModal({
  ocrSettings, onSaveOcrSettings, onResetTransactions,
  onOpenImport, onOpenSync, onOpenBackup, onOpenBenefits, onClose, desktop,
}: SettingsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [keyDraft, setKeyDraft] = useState((ocrSettings && ocrSettings.apiKey) || '');
  const [modelDraft, setModelDraft] = useState((ocrSettings && ocrSettings.model) || '');
  const savedKey = (ocrSettings && ocrSettings.apiKey) || '';
  // Se enseñan los últimos 4 para que se reconozca cuál es, sin exponerla.
  const maskedKey = savedKey ? `•••• ${savedKey.slice(-4)}` : null;

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
        <button onClick={onOpenSync} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <RefreshCw size={15} /> Sincronizar dispositivos
        </button>
        <button onClick={onOpenBackup} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <DatabaseBackup size={15} /> Respaldo de datos
        </button>
        <button onClick={onOpenBenefits} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <Gift size={15} /> Beneficios y promociones
        </button>
        <button onClick={onOpenImport} className="w-full py-3 rounded-xl text-sm font-semibold mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Importar desde Monefy</button>

        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Escaneo de tickets (IA)</p>
          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
            La key se guarda solo en este dispositivo y se envía directo a Anthropic junto con la foto del ticket. No se incluye en la sincronización ni en los respaldos. Usa una key dedicada para Hilo con un límite de gasto mensual: {' '}
            <span style={{ color: COLORS.textFaint }}>console.anthropic.com/settings/keys</span>
          </p>
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>API key {maskedKey ? `· guardada (${maskedKey})` : ''}</p>
          <input
            type="password"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>Modelo</p>
          <input
            type="text"
            value={modelDraft}
            onChange={e => setModelDraft(e.target.value)}
            placeholder={RECEIPT_MODEL_DEFAULT}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Déjalo vacío para usar el modelo por defecto (Haiku, más barato). Puedes poner otro id si quieres más precisión.</p>
          <div className="flex gap-2">
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
