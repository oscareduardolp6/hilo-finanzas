import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  openDb,
  loadState,
  saveState,
  loadOcrSettings,
  saveOcrSettings,
  STORAGE_KEY,
  OCR_SETTINGS_STORAGE_KEY,
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
