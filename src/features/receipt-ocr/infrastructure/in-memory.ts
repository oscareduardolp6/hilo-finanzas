/* El doble del puerto de escaneo. Vive en la feature y no en
   `shared/infrastructure/in-memory.ts` porque `shared/` no importa de
   `features/` — y sus tipos son de aquí.

   Con esto un test escanea un ticket sin `<canvas>`, sin red y sin API key:
   se le dice qué "leyó" el modelo, o con qué error falló. */

import type { ReceiptScan } from '../domain/draft';
import type { ReceiptGateway, ScanReceiptRequest, VerifyKeyRequest } from '../domain/ports';

export type FakeReceiptLog = {
  /** Lo que se le pidió escanear, para asertar el request. */
  scanned: ScanReceiptRequest[];
  /** Los nombres de archivo preparados, en orden. */
  prepared: string[];
  verified: VerifyKeyRequest[];
};

export const fakeReceiptLog = (): FakeReceiptLog => ({ scanned: [], prepared: [], verified: [] });

export const fakeReceiptGateway = (
  result: ReceiptScan | Error,
  log: FakeReceiptLog = fakeReceiptLog(),
  /** Qué responde "Probar clave": nada = válida. */
  verifyResult?: Error,
): ReceiptGateway => ({
  prepare: async (file) => {
    log.prepared.push(file.name);
    // El nombre viaja en `data` para que un test pueda comprobar el orden.
    return { media_type: file.type || 'image/jpeg', data: btoa(file.name) };
  },
  scan: async (request) => {
    log.scanned.push(request);
    if (result instanceof Error) throw result;
    return result;
  },
  verify: async (request) => {
    log.verified.push(request);
    if (verifyResult) throw verifyResult;
  },
});
