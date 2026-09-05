/* La implementación real del puerto: `<canvas>` + `FileReader` para la foto, y
   `fetch` contra la API de Anthropic para leerla. Es el único adaptador de
   Hilo que sale a la red. */

import { downscaleImage, fileToBase64 } from '../../../shared/infrastructure/image';
import type { ReceiptGateway } from '../domain/ports';
import { scanReceipt } from './anthropic';

export const browserReceiptGateway: ReceiptGateway = {
  prepare: (file) => downscaleImage(file).then(fileToBase64),
  scan: scanReceipt,
};
