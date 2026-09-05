/* Componente de LÓGICA de la hoja de respaldo.

   Partido en dos como `SyncContainer`, y por lo mismo: el respaldo a medio leer
   y el error viven en `BackupSheet`, que se monta y se DESMONTA con la hoja.
   Así, cerrar en el "¿seguro?" y volver a abrir no reencuentra la confirmación
   esperando — que es lo que hacía cuando el modal se montaba condicionalmente. */

import { useState } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import type { DataState } from '../../../../shared/domain/types';
import { BackupModal } from '../components/BackupModal';

export type BackupContainerProps = {
  desktop?: boolean;
};

export function BackupContainer({ desktop }: BackupContainerProps) {
  const open = useHiloStore((s) => s.backupModalOpen);
  if (!open) return null;
  return <BackupSheet desktop={desktop} />;
}

function BackupSheet({ desktop }: BackupContainerProps) {
  const setOpen = useHiloStore((s) => s.setBackupModalOpen);
  const accounts = useHiloStore((s) => s.accounts);
  const transactions = useHiloStore((s) => s.transactions);

  const downloadBackup = useHiloStore((s) => s.downloadBackup);
  const copyBackup = useHiloStore((s) => s.copyBackup);
  const readBackupFile = useHiloStore((s) => s.readBackupFile);
  const restoreBackup = useHiloStore((s) => s.restoreBackup);

  const [pending, setPending] = useState<DataState | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  return (
    <BackupModal
      current={{ transactions: transactions.length, accounts: accounts.length }}
      pending={pending && { transactions: pending.transactions.length, accounts: pending.accounts.length }}
      copied={copied}
      error={error}
      onBackup={downloadBackup}
      onCopy={() => {
        void copyBackup().then((outcome) => {
          if (!outcome.ok) { setError(outcome.message); return; }
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      onFile={(file) => {
        setError('');
        void readBackupFile(file).then((outcome) => {
          if (outcome.ok) setPending(outcome.backup);
          else setError(outcome.message);
        });
      }}
      onCancelRestore={() => setPending(null)}
      onConfirmRestore={() => {
        if (!pending) return;
        restoreBackup(pending);
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
