/* Componente de LÓGICA de la hoja de escanear ticket.

   Partido en dos como los de `backup` y `monefy-import`: las fotos elegidas
   viven en `ReceiptScanSheet`, que se desmonta al cerrar. Un ticket a medio
   fotografiar no debe seguir ahí la próxima vez que se abra la cámara.

   Todo el estado de aquí es borrador de UI —qué fotos van, en qué orden—; lo
   único que sale al store es la acción de escanear. Si sale bien, el store
   cierra esta hoja y abre el formulario de movimiento con el ticket. */

import { useEffect, useRef, useState } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { MAX_RECEIPT_PHOTOS } from '../../domain/config';
import { ReceiptScanModal } from '../components/ReceiptScanModal';
import type { ReceiptPhoto, ReceiptStep } from '../components/ReceiptScanModal';

export type ReceiptScanContainerProps = {
  desktop?: boolean;
};

export function ReceiptScanContainer({ desktop }: ReceiptScanContainerProps) {
  const open = useHiloStore((s) => s.receiptModalOpen);
  if (!open) return null;
  return <ReceiptScanSheet desktop={desktop} />;
}

type Picked = ReceiptPhoto & { file: File };

function ReceiptScanSheet({ desktop }: ReceiptScanContainerProps) {
  const setOpen = useHiloStore((s) => s.setReceiptModalOpen);
  const setSettingsOpen = useHiloStore((s) => s.setSettingsOpen);
  const ocrSettings = useHiloStore((s) => s.ocrSettings);
  const scanReceipt = useHiloStore((s) => s.scanReceipt);

  const [step, setStep] = useState<ReceiptStep>('capture');
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<Picked[]>([]);
  // Ids locales de la lista, no datos de Hilo: un contador basta.
  const nextId = useRef(0);

  // Las miniaturas son `blob:` URLs: se liberan al desmontar la hoja.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => { photosRef.current.forEach(p => URL.revokeObjectURL(p.url)); }, []);

  return (
    <ReceiptScanModal
      step={step}
      hasApiKey={!!ocrSettings.apiKey}
      error={error}
      photos={photos}
      maxPhotos={MAX_RECEIPT_PHOTOS}
      onAddFiles={(files) => {
        setError('');
        setPhotos(prev => {
          const room = Math.max(0, MAX_RECEIPT_PHOTOS - prev.length);
          const added = files.slice(0, room).map(file => ({
            id: `foto_${++nextId.current}`,
            url: URL.createObjectURL(file),
            name: file.name,
            file,
          }));
          return [...prev, ...added];
        });
      }}
      onRemovePhoto={(id) => setPhotos(prev => {
        const gone = prev.find(p => p.id === id);
        if (gone) URL.revokeObjectURL(gone.url);
        return prev.filter(p => p.id !== id);
      })}
      onScan={() => {
        setError('');
        setStep('processing');
        void scanReceipt(photos.map(p => p.file)).then((outcome) => {
          // Si salió bien el store ya cerró esta hoja; si no, las fotos se
          // quedan para reintentar sin volver a tomarlas.
          if (!outcome.ok) { setError(outcome.message); setStep('capture'); }
        });
      }}
      onOpenSettings={() => { setOpen(false); setSettingsOpen(true); }}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
