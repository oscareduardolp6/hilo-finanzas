/* Componente de LÓGICA de Ajustes.

   Es el container más pequeño del refactor, y el que cierra el paso 12: con él
   `DesktopShell` deja de recibir props por completo. Partido en dos como los
   demás, para que el "¿seguro?" de borrar movimientos no siga esperando al
   reabrir la hoja. */

import { useHiloStore } from '../../../../app/store-context';
import { SettingsModal } from '../components/SettingsModal';

export type SettingsContainerProps = {
  desktop?: boolean;
};

export function SettingsContainer({ desktop }: SettingsContainerProps) {
  const open = useHiloStore((s) => s.settingsOpen);
  if (!open) return null;
  return <SettingsSheet desktop={desktop} />;
}

function SettingsSheet({ desktop }: SettingsContainerProps) {
  const setOpen = useHiloStore((s) => s.setSettingsOpen);
  const ocrSettings = useHiloStore((s) => s.ocrSettings);
  const saveOcrSettings = useHiloStore((s) => s.saveOcrSettings);
  const openFromSettings = useHiloStore((s) => s.openFromSettings);
  const resetTransactions = useHiloStore((s) => s.resetTransactions);

  return (
    <SettingsModal
      ocrSettings={ocrSettings}
      onSaveOcrSettings={(settings) => void saveOcrSettings(settings)}
      onResetTransactions={resetTransactions}
      onOpenImport={() => openFromSettings('import')}
      onOpenSync={() => openFromSettings('sync')}
      onOpenBackup={() => openFromSettings('backup')}
      onOpenBenefits={() => openFromSettings('benefits')}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
