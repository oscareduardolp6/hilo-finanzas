/* Componente de RENDERIZADO de la hoja de escanear ticket: props → JSX.

   Cuatro pantallas —capturar, procesando, revisar, guardando— y ninguna decide
   nada. Las once derivaciones que antes se calculaban aquí entre el JSX (sumas,
   neto, descuadre, qué cuentas participan, si se puede guardar) entran hechas
   en `totals`, y la llamada a la API se fue al gateway. */

import { Check, Plus, ScanLine, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { Account, Category } from '../../../../shared/domain/types';
import { AccountChips } from '../../../../shared/ui/account-chips';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import type { ReceiptDiscount, ReceiptDraft, ReceiptRow } from '../../domain/draft';
import { rowAccountId } from '../../domain/review';
import type { ReviewTotals } from '../../domain/review';

export type ReceiptStep = 'capture' | 'processing' | 'review' | 'saving';

export type ReceiptScanModalProps = {
  step: ReceiptStep;
  accounts: Account[];
  expenseCategories: Category[];
  /** Sin key la hoja solo ofrece ir a Ajustes. */
  hasApiKey: boolean;
  error: string;
  draft: ReceiptDraft | null;
  store: string;
  date: string;
  rows: ReceiptRow[];
  discounts: ReceiptDiscount[];
  primaryAccountId: string;
  originAccountId: string;
  accountModes: Record<string, boolean | undefined>;
  totals: ReviewTotals;
  onFile: (file: File) => void;
  onStore: (value: string) => void;
  onDate: (value: string) => void;
  onPrimaryAccount: (id: string) => void;
  onOriginAccount: (id: string) => void;
  onPatchRow: (id: string, patch: Partial<ReceiptRow>) => void;
  onPatchDiscount: (id: string, patch: Partial<ReceiptDiscount>) => void;
  onAddDiscount: () => void;
  onToggleAccountMode: (accountId: string) => void;
  onConfirm: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function ReceiptScanModal({
  step, accounts, expenseCategories, hasApiKey, error, draft,
  store, date, rows, discounts, primaryAccountId, originAccountId, accountModes, totals,
  onFile, onStore, onDate, onPrimaryAccount, onOriginAccount, onPatchRow, onPatchDiscount,
  onAddDiscount, onToggleAccountMode, onConfirm, onOpenSettings, onClose, desktop,
}: ReceiptScanModalProps) {
  const accountName = (id: string): string => {
    const a = accounts.find(x => x.id === id);
    return a ? a.name : '—';
  };

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) onFile(file);
  }

  const { includedRows, usedAccountIds, anyTransfer, sumRows, sumDiscounts, net, mismatch, totalCount, canSave } = totals;
  const ticketTotal = draft ? draft.ticketTotal : 0;

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Escanear ticket</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {step === 'capture' && !hasApiKey && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-sm leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Para escanear tickets necesitas configurar tu API key de Anthropic en Ajustes. La foto se envía directo a la API de Anthropic con tu key; no pasa por ningún servidor de Hilo.
          </p>
          <button onClick={onOpenSettings} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Ir a Ajustes
          </button>
        </div>
      )}

      {step === 'capture' && hasApiKey && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Toma o sube una foto del ticket. Se envía a la API de Anthropic con tu key; la imagen no se guarda.
          </p>
          <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border cursor-pointer" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: COLORS.surfaceAlt }}>
            <ScanLine size={20} style={{ color: COLORS.textMuted }} />
            <span className="text-sm font-medium" style={{ color: COLORS.text }}>Seleccionar o tomar foto</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>
          {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
        </div>
      )}

      {step === 'processing' && (
        <div className="px-5 py-12 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Leyendo el ticket…</p>
        </div>
      )}

      {step === 'saving' && (
        <div className="px-5 py-12 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Guardando…</p>
        </div>
      )}

      {step === 'review' && draft && (
        <div className="px-5 mt-3 pb-6">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tienda</p>
              <input type="text" value={store} onChange={e => onStore(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha</p>
              <input type="date" value={date} onChange={e => onDate(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
            </div>
          </div>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuenta principal</p>
          <div className="mb-4"><AccountChips accounts={accounts} value={primaryAccountId} onSelect={onPrimaryAccount} /></div>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Artículos ({includedRows.length})</p>
          <div className="space-y-2 mb-4">
            {rows.map(r => {
              const isTransfer = !!accountModes[rowAccountId(r, primaryAccountId)];
              return (
                <div key={r.id} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, opacity: r.included ? 1 : 0.5 }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onPatchRow(r.id, { included: !r.included })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: r.included ? COLORS.accent : 'transparent', border: `1px solid ${r.included ? COLORS.accent : COLORS.borderStrong}` }}>
                      {r.included && <Check size={12} style={{ color: COLORS.bg }} />}
                    </button>
                    <input value={r.description} onChange={e => onPatchRow(r.id, { description: e.target.value })} placeholder="Artículo" className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs" style={{ color: COLORS.textFaint }}>$</span>
                      <input value={r.amount} onChange={e => onPatchRow(r.id, { amount: e.target.value })} inputMode="decimal" className="w-20 px-2 py-1 rounded-lg text-sm outline-none text-right font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                    </div>
                  </div>
                  {r.included && (
                    <div className="mt-2 ml-7 flex items-center gap-2 flex-wrap">
                      <select value={r.categoryId} onChange={e => onPatchRow(r.id, { categoryId: e.target.value })} className="px-2 py-1 rounded-lg text-xs outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                        {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select value={r.accountId || ''} onChange={e => onPatchRow(r.id, { accountId: e.target.value || null })} className="px-2 py-1 rounded-lg text-xs outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                        <option value="">{`Principal · ${accountName(primaryAccountId)}`}</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: isTransfer ? COLORS.accentSoft : COLORS.expenseSoft, color: isTransfer ? COLORS.accent : COLORS.expense }}>
                        {isTransfer ? 'Transferencia · gasto' : 'Gasto'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {usedAccountIds.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuentas de este ticket</p>
              <div className="space-y-2 mb-2">
                {usedAccountIds.map(id => {
                  const on = !!accountModes[id];
                  return (
                    <button key={id} onClick={() => onToggleAccountMode(id)} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
                      <div className="flex-1 text-left pr-3">
                        <span className="text-sm font-medium block" style={{ color: COLORS.text }}>{accountName(id)}</span>
                        <span className="text-xs block mt-0.5" style={{ color: COLORS.textFaint }}>{on ? 'Registrar como transferencia marcada como gasto' : 'Registrar como gasto simple'}</span>
                      </div>
                      <div className="w-10 h-6 rounded-full relative transition-colors shrink-0" style={{ backgroundColor: on ? COLORS.accent : COLORS.border }}>
                        <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: on ? 18 : 2 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mb-4 px-1" style={{ color: COLORS.textFaint }}>El modo "transferencia" es solo para este ticket; no cambia la cuenta.</p>
            </>
          )}

          {anyTransfer && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuenta de origen</p>
              <AccountChips accounts={accounts} value={originAccountId} onSelect={onOriginAccount} />
              <p className="text-xs mt-1 px-1" style={{ color: COLORS.textFaint }}>De aquí sale el dinero de las transferencias marcadas como gasto.</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Descuentos</p>
            <button onClick={onAddDiscount} className="text-xs font-medium flex items-center gap-1" style={{ color: COLORS.accent }}><Plus size={12} /> Agregar</button>
          </div>
          {discounts.length === 0 && <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Sin descuentos detectados.</p>}
          <div className="space-y-2 mb-1">
            {discounts.map(d => (
              <div key={d.id} className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, opacity: d.included ? 1 : 0.5 }}>
                <button onClick={() => onPatchDiscount(d.id, { included: !d.included })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: d.included ? COLORS.accent : 'transparent', border: `1px solid ${d.included ? COLORS.accent : COLORS.borderStrong}` }}>
                  {d.included && <Check size={12} style={{ color: COLORS.bg }} />}
                </button>
                <input value={d.label} onChange={e => onPatchDiscount(d.id, { label: e.target.value })} placeholder="Descuento" className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                <span className="text-xs" style={{ color: COLORS.textFaint }}>$</span>
                <input value={d.amount} onChange={e => onPatchDiscount(d.id, { amount: e.target.value })} inputMode="decimal" className="w-20 px-2 py-1 rounded-lg text-sm outline-none text-right font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
              </div>
            ))}
          </div>
          <p className="text-xs mb-4 px-1" style={{ color: COLORS.textFaint }}>Se registran como ingreso en la categoría "Descuentos".</p>

          <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex justify-between text-xs" style={{ color: COLORS.textMuted }}>
              <span>Suma de artículos</span><span className="font-mono-custom">{formatMoney(sumRows)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: COLORS.textMuted }}>
              <span>− Descuentos</span><span className="font-mono-custom">{formatMoney(sumDiscounts)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 font-medium" style={{ color: COLORS.text }}>
              <span>= Neto</span><span className="font-mono-custom">{formatMoney(net)}</span>
            </div>
            {ticketTotal > 0 && (
              <div className="flex justify-between text-xs mt-1" style={{ color: COLORS.textFaint }}>
                <span>Total del ticket</span><span className="font-mono-custom">{formatMoney(ticketTotal)}</span>
              </div>
            )}
          </div>
          {mismatch && <p className="text-xs mb-3 px-1" style={{ color: COLORS.accent }}>La suma no cuadra con el total del ticket; revisa los montos.</p>}

          <div className="flex gap-2 mt-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
              Descartar
            </button>
            <button onClick={onConfirm} disabled={!canSave} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: canSave ? COLORS.accent : COLORS.border, color: canSave ? COLORS.bg : COLORS.textFaint }}>
              Agregar {totalCount} {totalCount === 1 ? 'movimiento' : 'movimientos'}
            </button>
          </div>
        </div>
      )}
    </SheetOverlay>
  );
}
