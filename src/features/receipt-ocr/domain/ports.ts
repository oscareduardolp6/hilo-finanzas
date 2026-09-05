/* El puerto del escaneo. Vive en la feature y no en `shared/domain/ports.ts`
   porque sus tipos son de aquí: `ReceiptScan` es la forma que emite el modelo,
   y eso no es una capacidad genérica del navegador como copiar o compartir.

   Las dos operaciones van juntas en un solo puerto porque son el mismo paso
   desde fuera —"de esta foto, sácame un ticket"— y porque un test que finge una
   necesita fingir la otra: en jsdom no hay `<canvas>` ni red. */

import type { Category } from '../../../shared/domain/types';
import type { EncodedImage } from '../../../shared/infrastructure/image';
import type { ReceiptScan } from './draft';

export type ScanReceiptRequest = {
  apiKey: string;
  model: string;
  image: EncodedImage;
  expenseCategories: Category[];
};

export type ReceiptGateway = {
  /** Reescala la foto y la codifica para mandarla. */
  prepare: (file: File) => Promise<EncodedImage>;
  /** Llama al modelo de visión. Lanza con el mensaje en español que ve el
   *  usuario: distingue key inválida, límite de uso y falta de conexión. */
  scan: (request: ScanReceiptRequest) => Promise<ReceiptScan>;
};
