/* Puertos: lo que los casos de uso necesitan del mundo exterior, expresado como
   records de FUNCIONES (no clases). Cada uno tiene al menos dos implementaciones
   — la real en `shared/infrastructure/repositories.ts` y una en memoria en
   `shared/infrastructure/in-memory.ts` — y esa es toda la razón de ser del
   patrón repository aquí: poder correr un caso de uso sin IndexedDB, sin mocks
   de módulo y sin montar React. */

import type { TaskEither } from 'fp-ts/TaskEither';
import type { HiloError } from './errors';
import type { DataState, OcrSettings } from './types';

/** Las seis colecciones. `null` = perfil nuevo (o sin sesión). Implementada
 *  hoy sobre Firestore, un documento por usuario — ver
 *  `shared/infrastructure/firestore-state-repository.ts`. */
export type StateRepository = {
  readonly load: TaskEither<HiloError, DataState | null>;
  readonly save: (state: DataState) => TaskEither<HiloError, void>;
};

/** Clave propia: nunca entra al blob de datos ni a Firestore. */
export type OcrSettingsRepository = {
  readonly load: TaskEither<HiloError, OcrSettings | null>;
  /** `null` (o todo vacío) borra la entrada en vez de guardar una vacía. */
  readonly save: (settings: OcrSettings | null) => TaskEither<HiloError, void>;
};

/** Preferencia de "modo privado" (ocultar saldos) de ESTE dispositivo; tampoco viaja. */
export type HideBalancesRepository = {
  readonly load: TaskEither<HiloError, boolean | null>;
  readonly save: (value: boolean) => TaskEither<HiloError, void>;
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

/** El usuario autenticado, en el vocabulario angosto de Hilo (no el `User` de
 *  Firebase completo). */
export type AuthUser = {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
};

/* Sesión de Google, fuera del store de zustand a propósito — ver
   `app/auth-context.tsx`. Sus fallos no se modelan como `TaskEither`: son
   imperativos (como `ShareGateway`). `onError` existe porque un fallo de
   `signInWithGoogle()` no siempre pasa por su propia promesa: en el flujo de
   redirect (PWA instalada) el resultado se resuelve después de recargar la
   página, en un punto donde ya nadie espera esa promesa original — sin este
   canal, ese error solo llegaría a la consola y el usuario se queda viendo
   el botón de login sin ninguna pista. */
export type AuthGateway = {
  readonly signInWithGoogle: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  /** Devuelve la función para desuscribirse. `onError` es opcional: solo lo
   *  usa la implementación real, para el caso de arriba. */
  readonly onAuthStateChanged: (
    cb: (user: AuthUser | null) => void,
    onError?: (message: string) => void,
  ) => () => void;
};

/** Inyectados para que los casos de uso sean deterministas en test. */
export type Clock = () => number;
export type IdGenerator = (prefix?: string) => string;
