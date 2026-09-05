/* Las capacidades del navegador, implementadas. Cada una es el mismo código que
   estaba dentro de `SyncModal` / `BackupModal`, ahora detrás de su puerto.

   Todas fallan lanzando: el caso de uso las envuelve en `TaskEither` y decide
   el mensaje. */

import type { ClipboardGateway, DownloadGateway, FileGateway, ShareGateway } from '../domain/ports';
import { downloadJson } from './download';

export const browserFileGateway: FileGateway = {
  readText: (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsText(file);
    }),
};

export const browserClipboardGateway: ClipboardGateway = {
  writeText: (text) => navigator.clipboard.writeText(text),
};

export const browserShareGateway: ShareGateway = {
  canShare: () => typeof navigator !== 'undefined' && !!navigator.canShare,

  /* Compartir un archivo es lo bueno (llega como adjunto a WhatsApp o al
     correo); el texto es el plan B cuando el sistema no admite archivos. */
  shareFile: async (fileName, contents, text) => {
    const file = new File([contents], fileName, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Datos de Hilo' });
      return;
    }
    await navigator.share({ title: 'Datos de Hilo', text });
  },
};

export const browserDownloadGateway: DownloadGateway = {
  json: downloadJson,
};
