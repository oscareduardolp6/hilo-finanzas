/* El puerto del escaneo. Vive en la feature y no en `shared/domain/ports.ts`
   porque sus tipos son de aquí: `ReceiptScan` es la forma que emite el modelo,
   y eso no es una capacidad genérica del navegador como copiar o compartir.

   Las operaciones van juntas en un solo puerto porque son el mismo adaptador
   desde fuera —la API de Anthropic y la foto que se le manda— y porque un test
   que finge una necesita fingir las otras: en jsdom no hay `<canvas>` ni red. */

import type { Category } from '../../../shared/domain/types';
import type { EncodedImage } from '../../../shared/infrastructure/image';
import type { ReceiptScan } from './draft';

export type ScanReceiptRequest = {
  apiKey: string;
  model: string;
  /** Las fotos del ticket en orden, de arriba hacia abajo. Un ticket largo
   *  viene en varias, encimadas: el modelo junta los renglones repetidos. */
  images: EncodedImage[];
  expenseCategories: Category[];
};

export type VerifyKeyRequest = {
  apiKey: string;
  model: string;
};

export type ReceiptGateway = {
  /** Reescala la foto y la codifica para mandarla. */
  prepare: (file: File) => Promise<EncodedImage>;
  /** Llama al modelo de visión. Lanza con el mensaje en español que ve el
   *  usuario: distingue key inválida, límite de uso y falta de conexión. */
  scan: (request: ScanReceiptRequest) => Promise<ReceiptScan>;
  /** Comprueba la key y que el modelo exista, sin mandar ninguna foto (no
   *  cuesta nada). Resuelve si todo está bien; lanza con el mensaje si no. */
  verify: (request: VerifyKeyRequest) => Promise<void>;
};
