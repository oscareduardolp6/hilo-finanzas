/* El doble del puerto de escaneo. Vive en la feature y no en
   `shared/infrastructure/in-memory.ts` porque `shared/` no importa de
   `features/` — y sus tipos son de aquí.

   Con esto un test escanea un ticket sin `<canvas>`, sin red y sin API key:
   se le dice qué "leyó" el modelo, o con qué error falló. */

import type { ReceiptScan } from '../domain/draft';
import type { ReceiptGateway, ScanReceiptRequest } from '../domain/ports';

export type FakeReceiptLog = {
  /** Lo que se le pidió escanear, para asertar el request. */
  scanned: ScanReceiptRequest[];
};

export const fakeReceiptLog = (): FakeReceiptLog => ({ scanned: [] });

export const fakeReceiptGateway = (
  result: ReceiptScan | Error,
  log: FakeReceiptLog = fakeReceiptLog(),
): ReceiptGateway => ({
  prepare: async (file) => ({ media_type: file.type || 'image/jpeg', data: 'ZmFrZQ==' }),
  scan: async (request) => {
    log.scanned.push(request);
    if (result instanceof Error) throw result;
    return result;
  },
});
