import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  openDb,
  loadState,
  saveState,
  loadOcrSettings,
  saveOcrSettings,
  makeSyncState,
  loadSyncState,
  saveSyncState,
  STORAGE_KEY,
  OCR_SETTINGS_STORAGE_KEY,
  SYNC_STATE_STORAGE_KEY,
  PEER_TTL_MS,
} from '../../hilo-finanzas.jsx';

afterEach(() => vi.useRealTimers());

// Lee una clave cruda del object store, sin pasar por los helpers.
async function rawGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('state', 'readonly').objectStore('state').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/* Estado principal                                                   */
/* ------------------------------------------------------------------ */

describe('loadState / saveState', () => {
  it('round-trip del blob de las 5 colecciones', async () => {
    const blob = {
      accounts: [{ id: 'a' }],
      categories: [{ id: 'c' }],
      transactions: [{ id: 't' }],
      installmentPlans: [{ id: 'p' }],
      tombstones: [{ id: 'x', deletedAt: 1 }],
    };
    await saveState(blob);
    expect(await loadState()).toEqual(blob);
  });

  it('sin datos previos -> null', async () => {
    expect(await loadState()).toBe(null);
  });
});

/* ------------------------------------------------------------------ */
/* Config de OCR — clave aparte, nunca en STORAGE_KEY                  */
/* ------------------------------------------------------------------ */

describe('loadOcrSettings / saveOcrSettings', () => {
  it('guarda cuando hay apiKey o model', async () => {
    await saveOcrSettings({ apiKey: 'sk-1', model: '' });
    expect(await loadOcrSettings()).toEqual({ apiKey: 'sk-1', model: '' });
  });

  it('con apiKey y model ambos vacíos -> borra la entrada (no persiste)', async () => {
    await saveOcrSettings({ apiKey: 'sk-1', model: 'm' });
    await saveOcrSettings({ apiKey: '', model: '' });
    expect(await loadOcrSettings()).toBe(null);
  });

  it('la config de OCR no toca el blob STORAGE_KEY', async () => {
    await saveState({ accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] });
    await saveOcrSettings({ apiKey: 'sk-secreta', model: 'claude' });
    const mainBlob = await rawGet(STORAGE_KEY);
    expect(JSON.stringify(mainBlob)).not.toContain('sk-secreta');
    // y vive bajo su propia clave
    expect(await rawGet(OCR_SETTINGS_STORAGE_KEY)).toEqual({ apiKey: 'sk-secreta', model: 'claude' });
  });
});

/* ------------------------------------------------------------------ */
/* Sync state local — clave aparte, con poda de peers                 */
/* ------------------------------------------------------------------ */

describe('makeSyncState / loadSyncState / saveSyncState', () => {
  it('makeSyncState genera deviceId y un deviceName derivado', () => {
    const s = makeSyncState();
    expect(s.deviceId).toMatch(/^dev_/);
    expect(s.deviceName).toBe('Equipo-' + s.deviceId.slice(-4));
    expect(s.peers).toEqual({});
  });

  // Sin fake timers: rompen los callbacks async de fake-indexeddb. Se usan
  // marcas de tiempo relativas al Date.now() real.
  it('round-trip conservando peers recientes', async () => {
    const now = Date.now();
    const state = {
      deviceId: 'dev_abc', deviceName: 'Mi Laptop',
      peers: { p1: { name: 'Tel', lastSentAt: now - 1000, lastReceivedAt: now - 500 } },
    };
    await saveSyncState(state);
    const back = await loadSyncState();
    expect(back.deviceId).toBe('dev_abc');
    expect(back.deviceName).toBe('Mi Laptop');
    expect(back.peers.p1).toBeTruthy();
  });

  it('poda peers sin intercambio en más de PEER_TTL_MS', async () => {
    const now = Date.now();
    const state = {
      deviceId: 'dev_abc', deviceName: 'x',
      peers: {
        viejo: { name: 'V', lastSentAt: now - PEER_TTL_MS - 60_000, lastReceivedAt: 0 },
        fresco: { name: 'F', lastSentAt: 0, lastReceivedAt: now - 1000 },
      },
    };
    await saveSyncState(state);
    const back = await loadSyncState();
    expect(Object.keys(back.peers)).toEqual(['fresco']);
  });

  it('el sync state no toca el blob STORAGE_KEY y vive bajo su propia clave', async () => {
    await saveState({ accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] });
    await saveSyncState({ deviceId: 'dev_marca', deviceName: 'n', peers: {} });
    const mainBlob = await rawGet(STORAGE_KEY);
    expect(JSON.stringify(mainBlob)).not.toContain('dev_marca');
    expect(await rawGet(SYNC_STATE_STORAGE_KEY)).toMatchObject({ deviceId: 'dev_marca' });
  });
});
