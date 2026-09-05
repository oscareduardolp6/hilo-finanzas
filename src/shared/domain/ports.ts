/* Puertos: lo que los casos de uso necesitan del mundo exterior, expresado como
   records de FUNCIONES (no clases). Cada uno tiene al menos dos implementaciones
   — la real en `shared/infrastructure/repositories.ts` y una en memoria en
   `shared/infrastructure/in-memory.ts` — y esa es toda la razón de ser del
   patrón repository aquí: poder correr un caso de uso sin IndexedDB, sin mocks
   de módulo y sin montar React. */

import type { TaskEither } from 'fp-ts/TaskEither';
import type { HiloError } from './errors';
import type { DataState, OcrSettings, SyncState } from './types';

/** Las cinco colecciones, bajo `STORAGE_KEY`. `null` = perfil nuevo. */
export type StateRepository = {
  readonly load: TaskEither<HiloError, DataState | null>;
  readonly save: (state: DataState) => TaskEither<HiloError, void>;
};

/** Clave propia: nunca entra al blob de sync / QR / respaldo. */
export type OcrSettingsRepository = {
  readonly load: TaskEither<HiloError, OcrSettings | null>;
  /** `null` (o todo vacío) borra la entrada en vez de guardar una vacía. */
  readonly save: (settings: OcrSettings | null) => TaskEither<HiloError, void>;
};

/** Estado de sync LOCAL de este dispositivo; tampoco viaja. */
export type SyncStateRepository = {
  readonly load: TaskEither<HiloError, SyncState | null>;
  readonly save: (state: SyncState) => TaskEither<HiloError, void>;
};

/* --- Capacidades del navegador ---------------------------------------- */
/* Lo que antes se llamaba directo desde dentro de un componente: leer un
   archivo, copiar, compartir, bajar un JSON, pintar y escanear un QR. Como
   puertos, un caso de uso puede ejercitarlos sin navegador y un test puede
   fingir que el usuario denegó la cámara. */

export type FileGateway = {
  readonly readText: (file: File) => Promise<string>;
};

export type ClipboardGateway = {
  readonly writeText: (text: string) => Promise<void>;
};

export type ShareGateway = {
  /** Si es `false`, la UI ni siquiera ofrece el botón. */
  readonly canShare: () => boolean;
  readonly shareFile: (fileName: string, contents: string, text: string) => Promise<void>;
};

export type DownloadGateway = {
  readonly json: (payload: unknown, fileName: string) => void;
};

/** Una sesión de cámara en curso. Se cancela al cambiar de pestaña o cerrar. */
export type QrScanSession = {
  readonly result: Promise<Uint8Array>;
  readonly cancel: () => void;
};

/* El `HTMLVideoElement` en la firma es deliberado: la cámara tiene que pintarse
   en algún sitio y ese sitio lo decide la UI. Es el único puerto que toca el
   DOM, y a cambio el bucle de escaneo sale del componente. */
export type QrGateway = {
  /** Data URL con el QR. Si los bytes caben o no en uno lo decide quien
   *  llama: el límite es un concepto de Hilo, no del navegador. */
  readonly encode: (bytes: Uint8Array) => Promise<string>;
  readonly scan: (video: HTMLVideoElement) => QrScanSession;
};

/** Inyectados para que los casos de uso sean deterministas en test. */
export type Clock = () => number;
export type IdGenerator = (prefix?: string) => string;
