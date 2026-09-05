/* Componente de LÓGICA de la hoja de sincronizar.

   Es el container más grande del refactor, y con razón: aquí se juntan las tres
   cosas que la hoja hace y que no son pintar — elegir a quién enviar, preparar
   el payload y leer lo que llega. Ninguna toca el navegador directamente: todas
   pasan por acciones del slice, que es quien tiene los gateways.

   Va partido en dos a propósito. `SyncContainer` solo mira si la hoja está
   abierta; todo el estado vive en `SyncSheet`, que se monta y se DESMONTA con
   ella. Así, reabrir la hoja la devuelve a "Enviar" y sin errores viejos a la
   vista, que es lo que hacía cuando el modal se montaba condicionalmente — con
   el estado en el container, reabrir habría recordado la última pestaña. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { supportsCompression } from '../../../../shared/infrastructure/compression';
import type { SyncPeer } from '../../../../shared/domain/types';
import type { SharePreview } from '../../application/prepare-share';
import type { IncomingSource } from '../../application/receive-sync';
import { SyncModal } from '../components/SyncModal';
import type { SyncMode } from '../components/SyncModal';

export type SyncContainerProps = {
  desktop?: boolean;
};

export function SyncContainer({ desktop }: SyncContainerProps) {
  const open = useHiloStore((s) => s.syncModalOpen);
  if (!open) return null;
  return <SyncSheet desktop={desktop} />;
}

/** El peer con el intercambio más reciente: es el destinatario más probable. */
const mostRecentFirst = (a: [string, SyncPeer], b: [string, SyncPeer]) =>
  Math.max(b[1].lastSentAt || 0, b[1].lastReceivedAt || 0) - Math.max(a[1].lastSentAt || 0, a[1].lastReceivedAt || 0);

function SyncSheet({ desktop }: SyncContainerProps) {
  const setOpen = useHiloStore((s) => s.setSyncModalOpen);
  const syncState = useHiloStore((s) => s.syncState);
  const accounts = useHiloStore((s) => s.accounts);
  const categories = useHiloStore((s) => s.categories);
  const transactions = useHiloStore((s) => s.transactions);
  const installmentPlans = useHiloStore((s) => s.installmentPlans);
  const tombstones = useHiloStore((s) => s.tombstones);

  const receiveSync = useHiloStore((s) => s.receiveSync);
  const scanQr = useHiloStore((s) => s.scanQr);
  const prepareShare = useHiloStore((s) => s.prepareShare);
  const copyShareText = useHiloStore((s) => s.copyShareText);
  const shareOut = useHiloStore((s) => s.shareOut);
  const downloadShare = useHiloStore((s) => s.downloadShare);
  const canShare = useHiloStore((s) => s.canShare);
  const renameDevice = useHiloStore((s) => s.renameDevice);
  const forgetPeer = useHiloStore((s) => s.forgetPeer);
  const markSent = useHiloStore((s) => s.markSent);

  const [mode, setMode] = useState<SyncMode>('send');
  const [peerId, setPeerId] = useState('');
  const [sendAll, setSendAll] = useState(false);
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const cancelScanRef = useRef<(() => void) | null>(null);

  const peers = useMemo(() => Object.entries(syncState?.peers || {}), [syncState]);
  const peerKey = peers.map(([id]) => id).sort().join(',');

  // Autoselecciona el destinatario cuando cambia el CONJUNTO de peers, no cada
  // vez que uno de ellos se actualiza: si no, marcar como enviado movería la
  // selección debajo del dedo.
  useEffect(() => {
    const best = [...peers].sort(mostRecentFirst)[0];
    setPeerId(best ? best[0] : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey]);

  const selectedPeer = (peerId && syncState?.peers[peerId]) || null;
  const canDelta = !!(selectedPeer && selectedPeer.lastSentAt);
  const deltaSince = canDelta && !sendAll ? selectedPeer!.lastSentAt! : undefined;

  const stopScan = useCallback(() => {
    if (cancelScanRef.current) { cancelScanRef.current(); cancelScanRef.current = null; }
    setScanning(false);
  }, []);

  // Prepara lo que se mandaría al entrar a "Enviar" y cada vez que cambia el
  // alcance. `cancelled` evita que una preparación vieja pise a una nueva: el
  // gzip y el QR tardan lo suyo y el usuario puede cambiar de destinatario
  // mientras tanto.
  useEffect(() => {
    if (mode !== 'send') return undefined;
    let cancelled = false;
    void prepareShare({ since: deltaSince }).then((next) => {
      if (!cancelled) setPreview(next);
    });
    return () => { cancelled = true; };
  }, [mode, deltaSince, prepareShare, accounts, categories, transactions, installmentPlans, tombstones]);

  // Al desmontar (o sea, al cerrar la hoja) se apaga la cámara: dejarla
  // encendida es lo peor que puede hacer esta pantalla.
  useEffect(() => stopScan, [stopScan]);

  if (!syncState) return null;

  const receive = async (source: IncomingSource) => {
    setError('');
    setBusy(true);
    const outcome = await receiveSync(source);
    setBusy(false);
    if (outcome.ok) setOpen(false);
    else setError(outcome.message);
  };

  return (
    <SyncModal
      syncState={syncState}
      peers={peers}
      mode={mode}
      onMode={(next) => { stopScan(); setError(''); setMode(next); }}
      peerId={peerId}
      onPeerId={setPeerId}
      sendAll={sendAll}
      onSendAll={setSendAll}
      canDelta={canDelta}
      preview={preview}
      compressionSupported={supportsCompression()}
      canShare={canShare()}
      copied={copied}
      busy={busy}
      error={error}
      scanning={scanning}
      scanError={scanError}
      onStartScan={(video) => {
        setScanError('');
        setScanning(true);
        const session = scanQr(video);
        cancelScanRef.current = session.cancel;
        void session.result.then((outcome) => {
          setScanning(false);
          cancelScanRef.current = null;
          if (outcome.ok) setOpen(false);
          else setScanError(outcome.message);
        });
      }}
      onStopScan={stopScan}
      onReceiveText={(text) => void receive({ kind: 'text', text })}
      onReceiveFile={(file) => void receive({ kind: 'file', file })}
      onCopy={() => {
        if (!preview || !preview.text) return;
        void copyShareText(preview.text).then((outcome) => {
          if (!outcome.ok) { setError(outcome.message); return; }
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      onShare={() => {
        if (!preview) return;
        void shareOut(preview).then((outcome) => { if (!outcome.ok) setError(outcome.message); });
      }}
      onDownload={() => { if (preview) downloadShare(preview); }}
      onMarkSent={() => {
        // El punto es el `exportedAt` del payload que el usuario acaba de
        // mandar, no el ahora: entre generarlo y confirmarlo pasa rato.
        const at = preview ? (Date.parse(preview.payload.exportedAt) || undefined) : undefined;
        markSent(peerId, at);
      }}
      onRenameDevice={renameDevice}
      onForgetPeer={forgetPeer}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
