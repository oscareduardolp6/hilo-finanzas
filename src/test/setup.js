import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/* `shared/infrastructure/firebase.ts` llama `getAuth`/`getFirestore` al
   importarse (composition root vía `dependencies.ts`), y el SDK de Firebase
   revienta si `apiKey` falta — no hace falta que sea un proyecto real: ningún
   test toca la red (todo repositorio/gateway real se sobreescribe por uno en
   memoria vía `createDeps`/`renderFeature`), solo necesita pasar la
   validación local al inicializar. */
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-project.appspot.com');
vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '000000000000');
vi.stubEnv('VITE_FIREBASE_APP_ID', '1:000000000000:web:0000000000000000000000');

/* La implementación de Blob de jsdom es incompleta (sin `.stream()` ni, a veces,
   `.arrayBuffer()`), y `gzipString`/`gunzipBytes` la usan para el texto/QR de
   sincronización. En un navegador real existe. Usamos la Blob/File nativas de
   Node (completas y con Web Streams) en el entorno de test. */
globalThis.Blob = NodeBlob;
if (NodeFile) globalThis.File = NodeFile;

/* Con Blob/File de Node, el FileReader de jsdom ya no sabe leerlos. Polyfill
   mínimo apoyado en blob.text()/arrayBuffer() (Monefy import, respaldo, sync por
   archivo y fileToBase64 dependen de readAsText / readAsDataURL). */
class TestFileReader {
  constructor() { this.result = null; this.onload = null; this.onerror = null; }
  _finish(value) { this.result = value; if (this.onload) this.onload({ target: this }); }
  _fail(err) { if (this.onerror) this.onerror(err); }
  readAsText(blob) {
    Promise.resolve(blob.text()).then((t) => this._finish(t)).catch((e) => this._fail(e));
  }
  readAsDataURL(blob) {
    Promise.resolve(blob.arrayBuffer())
      .then((buf) => this._finish(`data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`))
      .catch((e) => this._fail(e));
  }
}
globalThis.FileReader = TestFileReader;

/* recharts (ExpenseDonut -> ResponsiveContainer) usa ResizeObserver, que jsdom
   no trae. Stub mínimo: nunca dispara, el donut se renderiza con tamaño 0 pero
   no rompe. */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/* jsdom no implementa matchMedia; `useIsDesktop` lo necesita. Por defecto se
   responde "no es escritorio" (móvil). Un test que quiera el árbol de escritorio
   puede sobreescribir window.matchMedia antes de renderizar. */
function installMatchMedia(matches = false) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/* recharts avisa por consola cuando el ResponsiveContainer mide 0x0 (siempre, en
   jsdom). Es ruido inofensivo: lo filtramos para no ensuciar la salida. */
const realWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('width(0) and height(0) of chart')) return;
  realWarn(...args);
};

/* `shared/infrastructure/auth.ts` llama `getRedirectResult` al importarse, y
   siempre falla en jsdom/Node ("operation-not-supported-in-this-environment"
   — el redirect de Firebase Auth necesita un navegador real). El error ya se
   atrapa con `.catch()` y no rompe ningún test; solo se filtra el log para no
   ensuciar la salida en cada archivo. */
const realError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Error al completar el login con Google')
  ) return;
  realError(...args);
};

beforeEach(() => {
  // IndexedDB limpio por test (el estado de Hilo se persiste ahí).
  globalThis.indexedDB = new IDBFactory();
  installMatchMedia(false);
  // `useIsDesktop` arranca leyendo window.innerWidth; por defecto en jsdom es
  // 1024. Fijamos un ancho móvil para no montar el árbol de escritorio.
  window.innerWidth = 375;
  window.innerHeight = 812;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
