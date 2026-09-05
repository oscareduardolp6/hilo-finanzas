/* Composition root: el único lugar del código donde se elige una implementación
   concreta de cada puerto. Todo lo demás recibe `Deps` por el Reader y no sabe
   si detrás hay IndexedDB o un objeto en memoria.

   Es un record de funciones, no un contenedor de inyección: `createDeps` arma el
   objeto y ya. Un test llama `createDeps({ stateRepository: inMemory..., clock:
   () => 0 })` y sobreescribe solo lo que le importa. */

import { uid } from '../shared/domain/ids';
import type {
  Clock, ClipboardGateway, DownloadGateway, FileGateway, IdGenerator, OcrSettingsRepository,
  QrGateway, ShareGateway, StateRepository, SyncStateRepository,
} from '../shared/domain/ports';
import {
  browserClipboardGateway,
  browserDownloadGateway,
  browserFileGateway,
  browserShareGateway,
} from '../shared/infrastructure/browser';
import { browserQrGateway } from '../shared/infrastructure/qr';
import {
  indexedDbOcrSettingsRepository,
  indexedDbStateRepository,
  indexedDbSyncStateRepository,
} from '../shared/infrastructure/repositories';

export type Deps = {
  readonly stateRepository: StateRepository;
  readonly ocrSettingsRepository: OcrSettingsRepository;
  readonly syncStateRepository: SyncStateRepository;
  /* Capacidades del navegador. Antes se llamaban directo desde dentro de un
     componente; como puertos, un test puede fingir que el usuario denegó la
     cámara o que el portapapeles está bloqueado. */
  readonly fileGateway: FileGateway;
  readonly clipboardGateway: ClipboardGateway;
  readonly shareGateway: ShareGateway;
  readonly downloadGateway: DownloadGateway;
  readonly qrGateway: QrGateway;
  /** `Date.now` inyectado: vuelve deterministas los `createdAt`/`updatedAt`. */
  readonly clock: Clock;
  /** `uid` inyectado: vuelve deterministas los ids en test. */
  readonly idGenerator: IdGenerator;
};

/** Las dependencias reales del navegador. */
export const productionDeps: Deps = {
  stateRepository: indexedDbStateRepository,
  ocrSettingsRepository: indexedDbOcrSettingsRepository,
  syncStateRepository: indexedDbSyncStateRepository,
  fileGateway: browserFileGateway,
  clipboardGateway: browserClipboardGateway,
  shareGateway: browserShareGateway,
  downloadGateway: browserDownloadGateway,
  qrGateway: browserQrGateway,
  clock: () => Date.now(),
  idGenerator: uid,
};

/** Las de producción con lo que se le pase encima. Pensado para tests. */
export const createDeps = (overrides: Partial<Deps> = {}): Deps => ({
  ...productionDeps,
  ...overrides,
});
