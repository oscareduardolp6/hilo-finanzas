/* Composition root: el único lugar del código donde se elige una implementación
   concreta de cada puerto. Todo lo demás recibe `Deps` por el Reader y no sabe
   si detrás hay IndexedDB o un objeto en memoria.

   Es un record de funciones, no un contenedor de inyección: `createDeps` arma el
   objeto y ya. Un test llama `createDeps({ stateRepository: inMemory..., clock:
   () => 0 })` y sobreescribe solo lo que le importa. */

import type { ReceiptGateway } from '../features/receipt-ocr/domain/ports';
import { browserReceiptGateway } from '../features/receipt-ocr/infrastructure/browser-receipt-gateway';
import { uid } from '../shared/domain/ids';
import type {
  AuthGateway, Clock, ClipboardGateway, DownloadGateway, FileGateway, HideBalancesRepository,
  IdGenerator, OcrSettingsRepository, ShareGateway, StateRepository,
} from '../shared/domain/ports';
import { browserAuthGateway } from '../shared/infrastructure/auth';
import {
  browserClipboardGateway,
  browserDownloadGateway,
  browserFileGateway,
  browserShareGateway,
} from '../shared/infrastructure/browser';
import {
  firestoreStateRepository,
  indexedDbHideBalancesRepository,
  indexedDbOcrSettingsRepository,
  indexedDbStateRepository,
} from '../shared/infrastructure/repositories';

export type Deps = {
  readonly stateRepository: StateRepository;
  /** El snapshot local previo a Firestore, de ESTE dispositivo — usado solo
   *  una vez por `migrate-to-firestore.ts` al iniciar sesión, nunca por el
   *  guardado normal. Ver "Migración de datos existentes" en
   *  `agents/plans/backend-sync.md`. */
  readonly legacyLocalStateRepository: StateRepository;
  readonly ocrSettingsRepository: OcrSettingsRepository;
  readonly hideBalancesRepository: HideBalancesRepository;
  /** Sesión de Google. Vive en `Deps` para que `AuthGate` (fuera del store,
   *  ver `app/auth-context.tsx`) también pueda inyectarse en test. */
  readonly authGateway: AuthGateway;
  /* Capacidades del navegador. Antes se llamaban directo desde dentro de un
     componente; como puertos, un test puede fingir que el usuario denegó la
     cámara o que el portapapeles está bloqueado. */
  readonly fileGateway: FileGateway;
  readonly clipboardGateway: ClipboardGateway;
  readonly shareGateway: ShareGateway;
  readonly downloadGateway: DownloadGateway;
  /* El único adaptador que sale a la red: reescala la foto del ticket y la
     manda a la API de visión de Anthropic. Su puerto vive en la feature y no
     en `shared/`, porque sus tipos son de ahí. */
  readonly receiptGateway: ReceiptGateway;
  /** `Date.now` inyectado: vuelve deterministas los `createdAt`/`updatedAt`. */
  readonly clock: Clock;
  /** `uid` inyectado: vuelve deterministas los ids en test. */
  readonly idGenerator: IdGenerator;
};

/** Las dependencias reales del navegador. */
export const productionDeps: Deps = {
  stateRepository: firestoreStateRepository,
  legacyLocalStateRepository: indexedDbStateRepository,
  ocrSettingsRepository: indexedDbOcrSettingsRepository,
  hideBalancesRepository: indexedDbHideBalancesRepository,
  authGateway: browserAuthGateway,
  fileGateway: browserFileGateway,
  clipboardGateway: browserClipboardGateway,
  shareGateway: browserShareGateway,
  downloadGateway: browserDownloadGateway,
  receiptGateway: browserReceiptGateway,
  clock: () => Date.now(),
  idGenerator: uid,
};

/** Las de producción con lo que se le pase encima. Pensado para tests. */
export const createDeps = (overrides: Partial<Deps> = {}): Deps => ({
  ...productionDeps,
  ...overrides,
});
