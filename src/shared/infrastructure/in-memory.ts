/* Contraparte en memoria de los puertos: el pago del patrón repository.

   Con esto, un caso de uso se corre en un test sin IndexedDB, sin
   `fake-indexeddb`, sin mocks de módulo y sin montar React — y además se puede
   forzar un fallo (`failWith`) para ejercitar la rama `Left` del `Either`, que
   con la implementación real es incómoda de provocar. */

import * as TE from 'fp-ts/TaskEither';
import { persistenceError } from '../domain/errors';
import type { HiloError } from '../domain/errors';
import type {
  ClipboardGateway, DownloadGateway, FileGateway, OcrSettingsRepository, QrGateway,
  ShareGateway, StateRepository, SyncStateRepository,
} from '../domain/ports';
import type { DataState, OcrSettings, SyncState } from '../domain/types';

export type InMemoryOptions<A> = {
  /** Contenido inicial. `null` (por defecto) = perfil nuevo. */
  initial?: A | null;
  /** Si se pasa, toda operación falla con este error. */
  failWith?: HiloError;
};

/** Un repositorio en memoria expone además `peek` para asertar lo guardado. */
export type InMemoryRepository<A, Port> = Port & {
  peek: () => A | null;
};

type Cell<A, SaveIn> = InMemoryRepository<
  A,
  {
    load: TE.TaskEither<HiloError, A | null>;
    save: (value: SaveIn) => TE.TaskEither<HiloError, void>;
  }
>;

/** Construye un repositorio `{ load, save }` sobre una celda mutable.
 *  `SaveIn` se separa de `A` porque el puerto de OCR admite guardar `null`, y
 *  `normalize` deja que cada puerto ajuste lo que termina almacenado. */
function makeRepository<A, SaveIn>(
  options: InMemoryOptions<A>,
  normalize: (value: SaveIn) => A | null,
): Cell<A, SaveIn> {
  let current: A | null = options.initial ?? null;
  const fail = options.failWith;

  return {
    load: fail ? TE.left(fail) : TE.fromIO(() => current),
    save: (value: SaveIn) =>
      fail
        ? TE.left(fail)
        : TE.fromIO(() => {
            current = normalize(value);
          }),
    peek: () => current,
  };
}

export function inMemoryStateRepository(
  options: InMemoryOptions<DataState> = {},
): InMemoryRepository<DataState, StateRepository> {
  return makeRepository<DataState, DataState>(options, (state) => state);
}

export function inMemoryOcrSettingsRepository(
  options: InMemoryOptions<OcrSettings> = {},
): InMemoryRepository<OcrSettings, OcrSettingsRepository> {
  // Igual que la implementación real: guardar una config vacía borra la entrada.
  return makeRepository<OcrSettings, OcrSettings | null>(options, (s) =>
    s && (s.apiKey || s.model) ? s : null,
  );
}

export function inMemorySyncStateRepository(
  options: InMemoryOptions<SyncState> = {},
): InMemoryRepository<SyncState, SyncStateRepository> {
  return makeRepository<SyncState, SyncState>(options, (state) => state);
}

/** Atajo para el caso más común en tests: "la persistencia está caída". */
export const brokenPersistence = (): HiloError => persistenceError(new Error('IndexedDB caído'));

/* --- Capacidades del navegador, fingidas ------------------------------- */
/* Cada una registra lo que se le pidió, para que un test asserte "se copió
   ESTO" en vez de espiar `navigator`. `failWith` fuerza la rama de error. */

export type FakeGatewayLog = {
  copied: string[];
  shared: { fileName: string; contents: string; text: string }[];
  downloaded: { payload: unknown; fileName: string }[];
  filesRead: File[];
};

export const fakeGatewayLog = (): FakeGatewayLog => ({
  copied: [], shared: [], downloaded: [], filesRead: [],
});

export const fakeFileGateway = (log: FakeGatewayLog, contents = ''): FileGateway => ({
  readText: async (file) => {
    log.filesRead.push(file);
    return contents;
  },
});

export const fakeClipboardGateway = (log: FakeGatewayLog, failWith?: Error): ClipboardGateway => ({
  writeText: async (text) => {
    if (failWith) throw failWith;
    log.copied.push(text);
  },
});

export const fakeShareGateway = (log: FakeGatewayLog, options: { canShare?: boolean; failWith?: Error } = {}): ShareGateway => ({
  canShare: () => options.canShare ?? true,
  shareFile: async (fileName, contents, text) => {
    if (options.failWith) throw options.failWith;
    log.shared.push({ fileName, contents, text });
  },
});

export const fakeDownloadGateway = (log: FakeGatewayLog): DownloadGateway => ({
  json: (payload, fileName) => { log.downloaded.push({ payload, fileName }); },
});

/** QR de mentira: codifica a un data URL falso y escanea lo que se le diga.
 *  `scanResult` puede ser bytes (éxito) o un Error (cámara denegada). */
export const fakeQrGateway = (scanResult: Uint8Array | Error = new Error('sin cámara')): QrGateway => ({
  encode: async (bytes) => `data:image/png;base64,qr-de-${bytes.length}-bytes`,
  scan: () => ({
    result: scanResult instanceof Error ? Promise.reject(scanResult) : Promise.resolve(scanResult),
    cancel: () => {},
  }),
});
