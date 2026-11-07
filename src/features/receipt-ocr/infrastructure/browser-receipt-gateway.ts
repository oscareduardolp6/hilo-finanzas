/* La implementación real del puerto: `<canvas>` + `FileReader` para la foto, y
   `fetch` contra la API de Anthropic para leerla. Es el único adaptador de
   Hilo que sale a la red. */

import { downscaleImage, fileToBase64 } from '../../../shared/infrastructure/image';
import type { EncodedImage } from '../../../shared/infrastructure/image';
import type { ReceiptGateway } from '../domain/ports';
import { scanReceipt, verifyKey } from './anthropic';

/** Lo que acepta la API de visión. */
const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/* `downscaleImage` devuelve el archivo original cuando el navegador no lo puede
   decodificar (p. ej. un HEIC en Chrome Android). Mandarlo tal cual acaba en un
   400 críptico del API; mejor decirlo aquí. */
async function prepare(file: File): Promise<EncodedImage> {
  const image = await fileToBase64(await downscaleImage(file));
  if (!SUPPORTED.has(image.media_type)) {
    throw new Error('Formato de imagen no soportado; usa una foto JPG o PNG.');
  }
  return image;
}

export const browserReceiptGateway: ReceiptGateway = {
  prepare,
  scan: scanReceipt,
  verify: verifyKey,
};
