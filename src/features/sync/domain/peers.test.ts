/* El estado de peers. La suite de regresión no lo cubre directamente: vivía
   dentro de handlers de `App`, así que solo se probaba por el DOM. */

import { describe, it, expect } from 'vitest';
import type { SyncState } from '../../../shared/domain/types';
import { forgetPeer, markPeerSent, peerName, recordPeerReceive, renameDevice, syncSummaryToast } from './peers';

const base: SyncState = {
  deviceId: 'yo',
  deviceName: 'Laptop',
  peers: { tel: { name: 'Teléfono', lastSentAt: 100, lastReceivedAt: 200 } },
};

describe('renameDevice', () => {
  it('recorta el nombre', () => {
    expect(renameDevice(base, '  Escritorio  ').deviceName).toBe('Escritorio');
  });

  it('un nombre vacío NO borra el que había', () => {
    // Quedarse sin nombre dejaría al otro dispositivo llamándote
    // "Dispositivo sin nombre" para siempre.
    expect(renameDevice(base, '   ').deviceName).toBe('Laptop');
  });
});

describe('forgetPeer', () => {
  it('quita el peer', () => {
    expect(forgetPeer(base, 'tel').peers).toEqual({});
  });

  it('un peer que no existe deja el estado intacto', () => {
    expect(forgetPeer(base, 'fantasma')).toBe(base);
  });
});

describe('markPeerSent', () => {
  it('avanza lastSentAt y conserva lo demás', () => {
    const out = markPeerSent(base, 'tel', 999);
    expect(out.peers['tel']).toEqual({ name: 'Teléfono', lastReceivedAt: 200, lastSentAt: 999 });
  });

  it('un peer nuevo se crea con lo mínimo', () => {
    const out = markPeerSent(base, 'tablet', 500);
    expect(out.peers['tablet']).toEqual({ name: '', lastReceivedAt: null, lastSentAt: 500 });
    // No toca al que ya estaba.
    expect(out.peers['tel']).toEqual(base.peers['tel']);
  });
});

describe('recordPeerReceive', () => {
  it('avanza lastReceivedAt SIN tocar lastSentAt', () => {
    // Es la asimetría que gobierna el delta: recibir no prueba nada sobre lo que
    // el peer tiene de lo mío.
    const out = recordPeerReceive(base, { id: 'tel', name: 'Teléfono' }, 777);
    expect(out!.peers['tel']).toEqual({ name: 'Teléfono', lastSentAt: 100, lastReceivedAt: 777 });
  });

  it('un export sin device no registra nada', () => {
    // Es un export de una versión anterior al sync incremental.
    expect(recordPeerReceive(base, null, 777)).toBeNull();
  });

  it('recibir un export propio no crea un peer de uno mismo', () => {
    expect(recordPeerReceive(base, { id: 'yo', name: 'Laptop' }, 777)).toBeNull();
  });

  it('un device sin nombre conserva el que ya se conocía', () => {
    const out = recordPeerReceive(base, { id: 'tel', name: '' }, 777);
    expect(out!.peers['tel']!.name).toBe('Teléfono');
  });
});

describe('peerName', () => {
  it('devuelve vacío cuando no hay nada que decir', () => {
    expect(peerName(base, 'fantasma')).toBe('');
    expect(peerName(null, 'tel')).toBe('');
  });
});

describe('syncSummaryToast', () => {
  it('es el texto que asserta la suite de integración', () => {
    expect(syncSummaryToast({ added: 2, updated: 0, removed: 0 }, '', false))
      .toBe('Sincronizado: 2 nuevos, 0 actualizados, 0 borrados');
  });

  it('nombra al peer y marca el envío parcial', () => {
    expect(syncSummaryToast({ added: 1, updated: 2, removed: 3 }, 'Teléfono', true))
      .toBe('Sincronizado con Teléfono: 1 nuevos, 2 actualizados, 3 borrados (parcial)');
  });
});
