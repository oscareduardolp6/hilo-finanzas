/* Componente de RENDERIZADO de la hoja de sincronizar: props → JSX.

   Conserva solo estado de BORRADOR — el texto pegado, el nombre a medio
   escribir y los dos "¿seguro?" —. Todo lo que era efecto (comprimir, pintar el
   QR, abrir la cámara, leer un archivo, copiar, compartir) se fue al container
   y de ahí a los gateways: aquí ya no hay un solo `useEffect` que hable con el
   navegador. */

import { useEffect, useRef, useState } from 'react';
import {
  Camera, Check, Copy, Download, QrCode, RefreshCw, Share2, Smartphone, Trash2, Upload, X,
} from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import type { SyncPeer, SyncState } from '../../../../shared/domain/types';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';
import type { SharePreview } from '../../application/prepare-share';

export type SyncMode = 'send' | 'receive' | 'devices';

export const SYNC_TABS: [SyncMode, string][] = [
  ['send', 'Enviar'],
  ['receive', 'Recibir'],
  ['devices', 'Dispositivos'],
];

export type SyncModalProps = {
  syncState: SyncState;
  peers: [string, SyncPeer][];
  mode: SyncMode;
  onMode: (mode: SyncMode) => void;
  peerId: string;
  onPeerId: (id: string) => void;
  sendAll: boolean;
  onSendAll: (all: boolean) => void;
  /** Hay un punto de sincronización con el peer elegido: se puede mandar delta. */
  canDelta: boolean;
  /** `null` mientras se prepara. */
  preview: SharePreview | null;
  compressionSupported: boolean;
  canShare: boolean;
  copied: boolean;
  busy: boolean;
  error: string;
  scanning: boolean;
  scanError: string;
  onStartScan: (video: HTMLVideoElement) => void;
  onStopScan: () => void;
  onReceiveText: (text: string) => void;
  onReceiveFile: (file: File) => void;
  onCopy: () => void;
  onShare: () => void;
  onDownload: () => void;
  onMarkSent: () => void;
  onRenameDevice: (name: string) => void;
  onForgetPeer: (peerId: string) => void;
  onClose: () => void;
  desktop?: boolean;
};

const fmtStamp = (ms: number | null | undefined): string =>
  (ms ? new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'nunca');

export function SyncModal({
  syncState, peers, mode, onMode, peerId, onPeerId, sendAll, onSendAll, canDelta,
  preview, compressionSupported, canShare, copied, busy, error, scanning, scanError,
  onStartScan, onStopScan, onReceiveText, onReceiveFile, onCopy, onShare, onDownload,
  onMarkSent, onRenameDevice, onForgetPeer, onClose, desktop,
}: SyncModalProps) {
  const [pasted, setPasted] = useState('');
  const [markSentConfirm, setMarkSentConfirm] = useState(false);
  const [resetPeerId, setResetPeerId] = useState('');
  const [nameDraft, setNameDraft] = useState(syncState.deviceName);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { setNameDraft(syncState.deviceName); }, [syncState.deviceName]);
  // Cambiar de destinatario o de alcance invalida el "¿seguro?" a medias.
  useEffect(() => { setMarkSentConfirm(false); }, [peerId, sendAll, mode]);

  const selectedPeer = (peerId && syncState.peers[peerId]) || null;
  const kb = preview && preview.bytes != null ? Math.max(1, Math.round(preview.bytes / 1024)) : null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) onReceiveFile(file);
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Sincronizar dispositivos</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <div className="px-5 mt-3 pb-6">
        <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
          Pasa tus datos de un dispositivo a otro sin servidor. Al recibir, se <span style={{ color: COLORS.text }}>combinan</span> con lo que ya tengas (no se borra nada que no hayas borrado tú).
        </p>

        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: COLORS.surfaceAlt }}>
          {SYNC_TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onMode(id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: mode === id ? COLORS.accent : 'transparent', color: mode === id ? COLORS.bg : COLORS.textMuted }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'send' && (
          <div>
            {peers.length > 0 && (
              <div className="mb-3">
                <label className="text-[11px] font-semibold block mb-1" style={{ color: COLORS.textMuted }}>Enviar a</label>
                <select
                  value={peerId}
                  onChange={(e) => { onPeerId(e.target.value); onSendAll(false); }}
                  className="w-full rounded-xl p-2.5 text-sm mb-2"
                  style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
                >
                  {peers.map(([id, p]) => (
                    <option key={id} value={id}>{p.name || 'Dispositivo sin nombre'}</option>
                  ))}
                  <option value="">Otro / primera vez</option>
                </select>
                {canDelta && (
                  <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: COLORS.surfaceAlt }}>
                    {([[false, 'Solo cambios recientes'], [true, 'Todo']] as [boolean, string][]).map(([val, label]) => (
                      <button
                        key={String(val)}
                        onClick={() => onSendAll(val)}
                        className="flex-1 py-1.5 rounded-md text-[11px] font-semibold"
                        style={{ backgroundColor: sendAll === val ? COLORS.accent : 'transparent', color: sendAll === val ? COLORS.bg : COLORS.textMuted }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {preview && preview.qrDataUrl ? (
              <div className="rounded-xl p-4 mb-3 flex flex-col items-center" style={{ backgroundColor: '#FFFFFF' }}>
                <img src={preview.qrDataUrl} alt="Código QR con tus datos" className="w-56 h-56" />
              </div>
            ) : (
              <div className="rounded-xl p-3 mb-3 flex items-start gap-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <QrCode size={16} style={{ color: COLORS.textFaint, marginTop: 2 }} />
                <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                  {!compressionSupported
                    ? 'Este navegador no puede comprimir; usa el archivo.'
                    : preview && preview.since != null
                      ? `Aún con solo los cambios recientes${kb ? ` (${kb} KB)` : ''} no cabe en un QR. Usa el archivo o el texto.`
                      : `Tu historial${kb ? ` (${kb} KB)` : ''} es muy grande para un QR. Usa el archivo o el texto.`}
                </p>
              </div>
            )}
            {preview && preview.since != null && (
              <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>
                Solo lo nuevo desde {fmtStamp(preview.since)} · {preview.count} {preview.count === 1 ? 'registro' : 'registros'}
              </p>
            )}
            <button onClick={onDownload} className="w-full py-3 rounded-xl text-sm font-semibold mb-2 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
              <Download size={15} /> Descargar archivo
            </button>
            {preview && preview.text && (
              <button onClick={onCopy} className="w-full py-3 rounded-xl text-sm font-semibold mb-2 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
                <Copy size={15} /> {copied ? 'Copiado' : 'Copiar texto'}
              </button>
            )}
            {canShare && (
              <button onClick={onShare} className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
                <Share2 size={15} /> Compartir
              </button>
            )}
            {peerId && (
              markSentConfirm ? (
                <div className="rounded-xl p-3 mt-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: COLORS.textMuted }}>
                    ¿El otro dispositivo ya escaneó o importó estos datos? Se marcará el punto de sincronización con <span style={{ color: COLORS.text }}>{selectedPeer && selectedPeer.name ? selectedPeer.name : 'ese dispositivo'}</span>; los próximos envíos solo llevarán lo nuevo.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setMarkSentConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>Cancelar</button>
                    <button
                      onClick={() => { onMarkSent(); setMarkSentConfirm(false); }}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
                    >Sí, marcar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setMarkSentConfirm(true)} className="w-full py-3 rounded-xl text-sm font-semibold mt-2 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
                  <Check size={15} /> Marcar como enviado{selectedPeer && selectedPeer.name ? ` a ${selectedPeer.name}` : ''}
                </button>
              )
            )}
          </div>
        )}

        {mode === 'receive' && (
          <div>
            {/* El `<video>` se monta SIEMPRE y solo se oculta: el gateway
                necesita el elemento en el momento de pulsar, y montarlo a la vez
                que `scanning` dejaría la ref vacía en esa primera pasada. Antes
                del refactor se montaba condicionalmente y funcionaba por un
                orden de renders que no conviene volver a apostar. */}
            <div className="rounded-xl overflow-hidden mb-2" style={{ backgroundColor: '#000', display: scanning ? 'block' : 'none' }}>
              <video ref={videoRef} playsInline muted className="w-full" style={{ maxHeight: 260, objectFit: 'cover' }} />
              <button onClick={onStopScan} className="w-full py-2 text-xs font-semibold" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.textMuted }}>Cancelar escaneo</button>
            </div>
            {!scanning && (
              <button
                onClick={() => { if (videoRef.current) onStartScan(videoRef.current); }}
                className="w-full py-3 rounded-xl text-sm font-semibold mb-2 flex items-center justify-center gap-2"
                style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}
              >
                <Camera size={15} /> Escanear QR
              </button>
            )}
            {scanError && <p className="text-xs mb-2" style={{ color: COLORS.expense }}>{scanError}</p>}

            <label className="w-full py-3 rounded-xl text-sm font-semibold mb-2 flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
              <Upload size={15} /> Subir archivo
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
            </label>

            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="…o pega aquí el texto que copiaste"
              rows={3}
              className="w-full rounded-xl p-3 text-xs mb-2 resize-none"
              style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            />
            <button
              onClick={() => onReceiveText(pasted)}
              disabled={busy || !pasted.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.accent, color: COLORS.bg, opacity: busy || !pasted.trim() ? 0.5 : 1 }}
            >
              <RefreshCw size={15} /> Combinar
            </button>
          </div>
        )}

        {mode === 'devices' && (
          <div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
              El <span style={{ color: COLORS.text }}>punto de sincronización</span> con cada dispositivo permite mandar solo lo nuevo por QR. Márcalo tú tras una sincronización completa; al recibir se guarda solo.
            </p>

            <label className="text-[11px] font-semibold block mb-1" style={{ color: COLORS.textMuted }}>Nombre de este dispositivo</label>
            <div className="flex gap-2 mb-4">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 rounded-xl p-2.5 text-sm"
                style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
              />
              <button
                onClick={() => onRenameDevice(nameDraft)}
                disabled={!nameDraft.trim() || nameDraft.trim() === syncState.deviceName}
                className="px-4 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: COLORS.accent, color: COLORS.bg, opacity: !nameDraft.trim() || nameDraft.trim() === syncState.deviceName ? 0.5 : 1 }}
              >
                Guardar
              </button>
            </div>

            {peers.length === 0 ? (
              <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <Smartphone size={16} style={{ color: COLORS.textFaint, marginTop: 2 }} />
                <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>Aún no has recibido de otro dispositivo.</p>
              </div>
            ) : (
              peers.map(([id, p]) => (
                <div key={id} className="rounded-xl p-3 mb-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: COLORS.text }}>{p.name || 'Dispositivo sin nombre'}</p>
                  <p className="text-[11px]" style={{ color: COLORS.textMuted }}>Enviado hasta: {fmtStamp(p.lastSentAt)}</p>
                  <p className="text-[11px] mb-2" style={{ color: COLORS.textMuted }}>Recibido hasta: {fmtStamp(p.lastReceivedAt)}</p>
                  {resetPeerId === id ? (
                    <div className="flex gap-2">
                      <button onClick={() => setResetPeerId('')} className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>Cancelar</button>
                      <button onClick={() => { onForgetPeer(id); setResetPeerId(''); }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Reiniciar</button>
                    </div>
                  ) : (
                    <button onClick={() => setResetPeerId(id)} className="text-xs font-semibold flex items-center gap-1" style={{ color: COLORS.expense }}>
                      <Trash2 size={13} /> Reiniciar punto
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
      </div>
    </SheetOverlay>
  );
}
