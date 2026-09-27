/* La capa física de persistencia LOCAL: IndexedDB nativo, sin librería
   envolvente. Desde que `StateRepository` pasó a estar respaldado por
   Firestore (ver `shared/infrastructure/firestore-state-repository.ts`), lo
   que queda aquí son las claves puramente locales de este dispositivo, que
   nunca deben viajar a la nube:

     STORAGE_KEY               → snapshot histórico de las 6 colecciones (ya no
                                  se escribe; solo lo lee la migración inicial
                                  a Firestore, ver `app/application/migrate-to-firestore.ts`)
     OCR_SETTINGS_STORAGE_KEY  → api key + modelo del escaneo de tickets
     HIDE_BALANCES_STORAGE_KEY → preferencia de "modo privado" de ESTE dispositivo

   Estas funciones devuelven Promises, no `TaskEither`, a propósito: son la API
   pública histórica de Hilo (los 9 tests de `test/unit/persistence.test.js` las
   llaman así). Los puertos monádicos las envuelven en `repositories.ts`. */

import type { DataState, OcrSettings } from '../domain/types';

export const STORAGE_KEY = 'hilo_finanzas_data_v1';
export const OCR_SETTINGS_STORAGE_KEY = 'hilo_receipt_ocr_settings';
export const HIDE_BALANCES_STORAGE_KEY = 'hilo_hide_balances_v1';

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

export function loadHideBalances(): Promise<boolean | null> {
  return getKey<boolean>(HIDE_BALANCES_STORAGE_KEY);
}

export function saveHideBalances(value: boolean): Promise<void> {
  return putKey(HIDE_BALANCES_STORAGE_KEY, value);
}
