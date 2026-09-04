/* La capa física de persistencia: IndexedDB nativo, sin librería envolvente.
   Una sola base (`hilo_finanzas`) con un solo object store (`state`) y TRES
   claves independientes:

     STORAGE_KEY              → las 5 colecciones (esto es lo que se sincroniza)
     OCR_SETTINGS_STORAGE_KEY → api key + modelo del escaneo de tickets
     SYNC_STATE_STORAGE_KEY   → id y peers de ESTE dispositivo

   Que sean claves separadas es lo que garantiza, por construcción, que la api
   key y el estado de sync nunca viajen en un export / QR / respaldo:
   `buildExportPayload` solo toca las 5 colecciones.

   Estas funciones devuelven Promises, no `TaskEither`, a propósito: son la API
   pública histórica de Hilo (los 9 tests de `test/unit/persistence.test.js` las
   llaman así). Los puertos monádicos las envuelven en `repositories.ts`. */

import { uid } from '../domain/ids';
import type { DataState, OcrSettings, SyncState, SyncPeer } from '../domain/types';

export const STORAGE_KEY = 'hilo_finanzas_data_v1';
export const OCR_SETTINGS_STORAGE_KEY = 'hilo_receipt_ocr_settings';
export const SYNC_STATE_STORAGE_KEY = 'hilo_sync_state_v1';

/** Peers sin intercambio en un año se podan al guardar. */
export const PEER_TTL_MS = 365 * 864e5;

const DB_NAME = 'hilo_finanzas';
const DB_VERSION = 1;
const STORE_NAME = 'state';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getKey<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) || null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function putKey(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function loadState(): Promise<DataState | null> {
  return getKey<DataState>(STORAGE_KEY);
}

export function saveState(data: DataState): Promise<void> {
  return putKey(STORAGE_KEY, data);
}

export function loadOcrSettings(): Promise<OcrSettings | null> {
  return getKey<OcrSettings>(OCR_SETTINGS_STORAGE_KEY);
}

/** Guardar una config vacía BORRA la entrada, en vez de dejar una en blanco. */
export async function saveOcrSettings(next: Partial<OcrSettings> | null): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (next && (next.apiKey || next.model)) {
      store.put({ apiKey: next.apiKey || '', model: next.model || '' }, OCR_SETTINGS_STORAGE_KEY);
    } else {
      store.delete(OCR_SETTINGS_STORAGE_KEY);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Estado de sync inicial de un dispositivo que nunca se ha sincronizado. */
export function makeSyncState(): SyncState {
  const id = uid('dev');
  return { deviceId: id, deviceName: 'Equipo-' + id.slice(-4), peers: {} };
}

export function loadSyncState(): Promise<SyncState | null> {
  return getKey<SyncState>(SYNC_STATE_STORAGE_KEY);
}

/** Poda los peers inactivos antes de guardar. */
export function saveSyncState(next: SyncState): Promise<void> {
  const cutoff = Date.now() - PEER_TTL_MS;
  const peers: Record<string, SyncPeer> = {};
  for (const [id, p] of Object.entries((next && next.peers) || {})) {
    if (Math.max(p.lastSentAt || 0, p.lastReceivedAt || 0) >= cutoff) peers[id] = p;
  }
  const clean: SyncState = { deviceId: next.deviceId, deviceName: next.deviceName || '', peers };
  return putKey(SYNC_STATE_STORAGE_KEY, clean);
}
