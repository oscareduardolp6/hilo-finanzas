/* Componente de RENDERIZADO de la hoja de escanear ticket: props → JSX.

   Dos pantallas —juntar las fotos, y leyéndolas— y ninguna decide nada. La
   revisión ya no vive aquí: un ticket leído abre el formulario de movimiento
   con su desglose, que es donde se corrige y se guarda.

   Hay dos entradas de foto a propósito: `capture` abre directo la cámara (y
   en Android esconde la galería), así que "Elegir de la galería" va sin él y
   con `multiple`. Las dos agregan a la misma lista. */

import { Camera, ImagePlus, ScanLine, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';

export type ReceiptStep = 'capture' | 'processing';

export type ReceiptPhoto = {
  id: string;
  /** `blob:` de la miniatura. */
  url: string;
  name: string;
};

export type ReceiptScanModalProps = {
  step: ReceiptStep;
  /** Sin key la hoja solo ofrece ir a Ajustes. */
  hasApiKey: boolean;
  error: string;
  photos: ReceiptPhoto[];
  maxPhotos: number;
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onScan: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function ReceiptScanModal({
  step, hasApiKey, error, photos, maxPhotos,
  onAddFiles, onRemovePhoto, onScan, onOpenSettings, onClose, desktop,
}: ReceiptScanModalProps) {
  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Vaciar el input: si no, volver a elegir la misma foto no dispara `change`.
    e.target.value = '';
    if (files.length) onAddFiles(files);
  }

  const full = photos.length >= maxPhotos;
  const pickerClass = 'flex-1 flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border cursor-pointer';
  const pickerStyle = { borderColor: COLORS.border, borderStyle: 'dashed' as const, backgroundColor: COLORS.surfaceAlt, opacity: full ? 0.4 : 1 };

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Escanear ticket</p>
        <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
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
          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
            Toma o sube una foto del ticket. Se envía a la API de Anthropic con tu key; la imagen no se guarda.
          </p>

          <div className="flex gap-2 mb-3">
            <label className={pickerClass} style={pickerStyle}>
              <Camera size={18} style={{ color: COLORS.textMuted }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Tomar foto</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={full} onChange={handleFiles} data-testid="receipt-camera" />
            </label>
            <label className={pickerClass} style={pickerStyle}>
              <ImagePlus size={18} style={{ color: COLORS.textMuted }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Elegir de la galería</span>
              <input type="file" accept="image/*" multiple className="hidden" disabled={full} onChange={handleFiles} data-testid="receipt-gallery" />
            </label>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {photos.map((p, i) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden aspect-[3/4]" style={{ backgroundColor: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
                  <img src={p.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute left-1 top-1 text-[10px] font-semibold px-1.5 rounded-full" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>{i + 1}</span>
                  <button onClick={() => onRemovePhoto(p.id)} aria-label={`Quitar foto ${i + 1}`} className="absolute right-1 top-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
                    <X size={11} style={{ color: COLORS.text }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textFaint }}>
            {full
              ? `Máximo ${maxPhotos} fotos por ticket.`
              : '¿Ticket largo? Tómale varias fotos de arriba hacia abajo, dejando que se encimen un poco: Hilo junta los renglones repetidos.'}
          </p>

          {error && (
            <div className="mb-3">
              <p className="text-xs" style={{ color: COLORS.expense }}>{error}</p>
              <button onClick={onOpenSettings} className="text-xs font-medium mt-1" style={{ color: COLORS.accent }}>Ir a Ajustes</button>
            </div>
          )}

          <button onClick={onScan} disabled={!photos.length} className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: photos.length ? COLORS.accent : COLORS.border, color: photos.length ? COLORS.bg : COLORS.textFaint }}>
            <ScanLine size={15} />
            {photos.length > 1 ? `Leer ticket (${photos.length} fotos)` : 'Leer ticket'}
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="px-5 py-12 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            {photos.length > 1 ? `Leyendo el ticket (${photos.length} fotos)…` : 'Leyendo el ticket…'}
          </p>
        </div>
      )}
    </SheetOverlay>
  );
}
