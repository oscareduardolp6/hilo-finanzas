/* El estado de sync LOCAL de este dispositivo: su nombre y, por cada peer, hasta
   dónde le mandé y hasta dónde recibí de él. Vive bajo su propia clave de
   IndexedDB, nunca dentro del blob que se sincroniza — si viajara, cada
   dispositivo sobreescribiría el punto de vista del otro.

   Los dos sellos NO son simétricos, y es el detalle que gobierna el delta:

   - `lastSentAt` decide qué lleva el próximo envío, y por eso lo avanza el
     usuario A MANO ("marcar como enviado"), después de confirmar que el otro
     lado lo recibió. Avanzarlo solo al generar el payload perdería datos si el
     envío no llegó.
   - `lastReceivedAt` es informativo y avanza solo al recibir. Recibir no prueba
     nada sobre lo que el peer tiene de lo mío. */

import type { SyncState } from '../../../shared/domain/types';
import type { ExportDevice } from './payload';
import type { MergeStats } from './merge';

/** El nombre con el que la UI se refiere a un peer. */
export function peerName(syncState: SyncState | null, peerId: string): string {
  return (syncState && syncState.peers[peerId] && syncState.peers[peerId]!.name) || '';
}

/** Renombrar este dispositivo. Un nombre vacío no borra el que había. */
export function renameDevice(syncState: SyncState, name: string): SyncState {
  return { ...syncState, deviceName: (name || '').trim() || syncState.deviceName };
}

/** Olvidar el punto de sincronización con un peer: el próximo envío le va
 *  completo. Un peer que no existe deja el estado intacto. */
export function forgetPeer(syncState: SyncState, peerId: string): SyncState {
  if (!syncState.peers[peerId]) return syncState;
  const peers = { ...syncState.peers };
  delete peers[peerId];
  return { ...syncState, peers };
}

/** Avanza `lastSentAt` conservando lo demás del peer. */
export function markPeerSent(syncState: SyncState, peerId: string, at: number): SyncState {
  const prev = syncState.peers[peerId] || {};
  return {
    ...syncState,
    peers: {
      ...syncState.peers,
      [peerId]: { name: prev.name || '', lastReceivedAt: prev.lastReceivedAt ?? null, lastSentAt: at },
    },
  };
}

/** Avanza `lastReceivedAt` del emisor. Devuelve `null` si no hay peer que
 *  registrar — sin `device` en el payload (export viejo) o si el emisor resulta
 *  ser este mismo dispositivo. */
export function recordPeerReceive(
  syncState: SyncState | null,
  device: ExportDevice | null,
  at: number,
): SyncState | null {
  if (!device || !device.id || !syncState || device.id === syncState.deviceId) return null;
  const prev = syncState.peers[device.id] || {};
  return {
    ...syncState,
    peers: {
      ...syncState.peers,
      [device.id]: {
        name: device.name || prev.name || '',
        lastSentAt: prev.lastSentAt ?? null,
        lastReceivedAt: at,
      },
    },
  };
}

/** El resumen que ve el usuario tras combinar. Es contrato de test:
 *  `test/integration/sync-backup.test.jsx` lo compara. */
export function syncSummaryToast(stats: MergeStats, who: string, partial: boolean): string {
  const withWho = who ? ` con ${who}` : '';
  const tail = partial ? ' (parcial)' : '';
  return `Sincronizado${withWho}: ${stats.added} nuevos, ${stats.updated} actualizados, ${stats.removed} borrados${tail}`;
}
