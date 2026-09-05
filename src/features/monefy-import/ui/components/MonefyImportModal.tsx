/* Componente de RENDERIZADO de la hoja de importar desde Monefy: props → JSX.

   Son cuatro pantallas —subir, revisar, importando, listo— y ninguna decide
   nada: `step` entra por props, igual que el archivo leído y el plan ya
   construido. Aquí no hay `FileReader`, ni se llama al parser, ni se arma el
   plan; solo se pinta lo que el container ya resolvió. */

import { Check, Layers, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { ACCOUNT_TYPES } from '../../../../shared/design/icons';
import { formatDateLabel } from '../../../../shared/domain/dates';
import type { Account } from '../../../../shared/domain/types';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import type { AccountDecision, AccountDecisions, MonefyImportPlan } from '../../domain/plan';
import type { MonefyPreview } from '../../domain/preview';

export type MonefyStep = 'upload' | 'review' | 'importing' | 'done';

export type MonefyImportModalProps = {
  step: MonefyStep;
  /** Para el aviso "ya existe en Hilo, se fusiona". */
  existingAccounts: Account[];
  fileName: string;
  error: string;
  preview: MonefyPreview | null;
  accountDecisions: AccountDecisions;
  useOscarConvention: boolean;
  result: MonefyImportPlan | null;
  onFile: (file: File) => void;
  onDecision: (name: string, patch: Partial<AccountDecision>) => void;
  onToggleOscar: () => void;
  onRunImport: () => void;
  onFinish: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function MonefyImportModal({
  step, existingAccounts, fileName, error, preview, accountDecisions, useOscarConvention, result,
  onFile, onDecision, onToggleOscar, onRunImport, onFinish, onClose, desktop,
}: MonefyImportModalProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) onFile(file);
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Importar desde Monefy</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {step === 'upload' && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Sube el CSV que exportas desde Monefy (no el backup cifrado). Todo se procesa en tu navegador, nada se sube a ningún servidor.
          </p>
          <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border cursor-pointer" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: COLORS.surfaceAlt }}>
            <Layers size={20} style={{ color: COLORS.textMuted }} />
            <span className="text-sm font-medium" style={{ color: COLORS.text }}>{fileName || 'Seleccionar archivo .csv'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
          {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
        </div>
      )}

      {step === 'review' && preview && (
        <div className="px-5 mt-3 pb-6">
          <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <p className="text-sm font-medium" style={{ color: COLORS.text }}>{preview.transactionCount} movimientos detectados</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
              {/* El rango solo es nulo con cero renglones, y ese caso no llega
                  hasta aquí: `readMonefyFile` lo rechaza antes con su mensaje. */}
              {formatDateLabel(preview.dateRange.min!)} — {formatDateLabel(preview.dateRange.max!)} · {preview.transferCount} transferencias
            </p>
            {useOscarConvention && preview.oscarConvention.seriesCount > 0 && (
              <p className="text-xs mt-0.5" style={{ color: COLORS.accent }}>{preview.oscarConvention.seriesCount} planes de MSI detectados por la convención de Oscar</p>
            )}
          </div>

          <button onClick={onToggleOscar} className="w-full flex items-center justify-between p-3 rounded-xl mb-4" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex-1 text-left pr-3">
              <span className="text-sm font-medium block" style={{ color: COLORS.text }}>Usar la convención de Oscar</span>
              <span className="text-xs block mt-0.5" style={{ color: COLORS.textFaint }}>Reconoce fracciones "(N/D)" como pagos de MSI y separa "item - lugar - tamaño - marca - cantidad". Es específico de esta forma de anotar en Monefy, no una función genérica.</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors shrink-0" style={{ backgroundColor: useOscarConvention ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: useOscarConvention ? 18 : 2 }} />
            </div>
          </button>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuentas detectadas</p>
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Si excluyes una cuenta, no se importa ninguno de sus movimientos; las transferencias donde participaba se convierten en gasto/ingreso en la otra cuenta.</p>

          <div className="space-y-2 mb-2">
            {preview.accounts.map(acc => {
              const decision = accountDecisions[acc.name] || { include: true, type: acc.suggestedType, name: acc.name };
              const existingMatch = existingAccounts.find(a => a.name.trim().toLowerCase() === (decision.name || acc.name).trim().toLowerCase());
              return (
                <div key={acc.name} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, opacity: decision.include ? 1 : 0.5 }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onDecision(acc.name, { include: !decision.include })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: decision.include ? COLORS.accent : 'transparent', border: `1px solid ${decision.include ? COLORS.accent : COLORS.borderStrong}` }}>
                      {decision.include && <Check size={12} style={{ color: COLORS.bg }} />}
                    </button>
                    <input value={decision.name} onChange={e => onDecision(acc.name, { name: e.target.value })} className="flex-1 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                  </div>
                  {acc.isGhost && (
                    <p className="text-xs mt-1.5 ml-7" style={{ color: COLORS.textFaint }}>Solo aparece en transferencias antiguas — probablemente renombrada o cerrada.</p>
                  )}
                  {existingMatch ? (
                    <p className="text-xs mt-1.5 ml-7" style={{ color: COLORS.income }}>Ya existe en Hilo, se fusiona.</p>
                  ) : decision.include && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2 ml-7">
                      {ACCOUNT_TYPES.map(t => {
                        const Icon = t.icon;
                        const isSel = decision.type === t.id;
                        return (
                          <button key={t.id} onClick={() => onDecision(acc.name, { type: t.id })} className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border" style={{ borderColor: isSel ? COLORS.accent : COLORS.border, backgroundColor: isSel ? COLORS.accentSoft : 'transparent' }}>
                            <Icon size={13} style={{ color: isSel ? COLORS.accent : COLORS.textMuted }} />
                            <span className="text-[10px] text-center leading-tight" style={{ color: COLORS.text }}>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={onRunImport} className="w-full mt-4 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Importar {preview.transactionCount} movimientos
          </button>
        </div>
      )}

      {step === 'importing' && (
        <div className="px-5 py-10 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Importando…</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="px-5 mt-3 pb-6">
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.incomeSoft }}>
            <p className="text-sm font-medium" style={{ color: COLORS.income }}>¡Listo! Se importaron {result.transactions.length} movimientos.</p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{result.accountsToAdd.length} cuentas nuevas · {result.categoriesToAdd.length} categorías nuevas{result.installmentPlansToAdd.length > 0 ? ` · ${result.installmentPlansToAdd.length} planes de MSI` : ''}</p>
          </div>
          <button onClick={onFinish} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Listo
          </button>
        </div>
      )}
    </SheetOverlay>
  );
}
