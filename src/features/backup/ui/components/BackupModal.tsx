/* Componente de RENDERIZADO de la hoja de respaldo: props → JSX.

   No queda un solo efecto que hable con el navegador: bajar, copiar y leer el
   archivo salieron a gateways, y aquí solo entra el `File` que el usuario
   eligió. Ni siquiera ve el respaldo leído — le bastan sus dos conteos, que es
   lo único que la confirmación enseña. */

import { Copy, DatabaseBackup, Upload, X } from 'lucide-react';
import { COLORS } from '../../../../shared/design/tokens';
import { SheetOverlay } from '../../../../shared/ui/sheet-overlay';

/** Cuántos movimientos y cuentas hay de un lado y del otro del reemplazo. */
export type BackupCounts = {
  transactions: number;
  accounts: number;
};

export type BackupModalProps = {
  /** Lo que hay ahora en este dispositivo. */
  current: BackupCounts;
  /** Lo que traería el respaldo leído, o `null` si no hay ninguno esperando. */
  pending: BackupCounts | null;
  copied: boolean;
  error: string;
  onBackup: () => void;
  onCopy: () => void;
  onFile: (file: File) => void;
  onCancelRestore: () => void;
  onConfirmRestore: () => void;
  onClose: () => void;
  desktop?: boolean;
};

export function BackupModal({
  current, pending, copied, error,
  onBackup, onCopy, onFile, onCancelRestore, onConfirmRestore, onClose, desktop,
}: BackupModalProps) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files && e.target.files[0];
    if (file) onFile(file);
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Respaldo de datos</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <div className="px-5 mt-3 pb-6">
        <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
          Un respaldo es una copia completa de tus datos para guardar por si algo falla. Restaurar <span style={{ color: COLORS.text }}>reemplaza todo</span> lo que tengas ahora en este dispositivo.
        </p>

        <button onClick={onBackup} className="w-full py-3 rounded-xl text-sm font-semibold mb-2 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <DatabaseBackup size={15} /> Respaldar ahora
        </button>
        <button onClick={onCopy} className="w-full py-3 rounded-xl text-sm font-semibold mb-4 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <Copy size={15} /> {copied ? 'Copiado' : 'Copiar texto'}
        </button>

        {!pending ? (
          <label className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
            <Upload size={15} /> Restaurar desde archivo
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>
              Se reemplazarán tus {current.transactions} movimientos y {current.accounts} cuentas actuales por los del respaldo ({pending.transactions} movimientos, {pending.accounts} cuentas). ¿Seguro?
            </p>
            <div className="flex gap-2">
              <button onClick={onCancelRestore} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={onConfirmRestore} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Sí, restaurar</button>
            </div>
          </div>
        )}

        {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
      </div>
    </SheetOverlay>
  );
}
