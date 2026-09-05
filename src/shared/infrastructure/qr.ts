/* El QR, en las dos direcciones: pintarlo (`qrcode`) y leerlo de la cámara
   (`getUserMedia` + `jsqr`).

   El bucle de escaneo era lo más imperativo que quedaba dentro de un
   componente: abría un stream, montaba un canvas oculto y se llamaba a sí mismo
   con `requestAnimationFrame`. Aquí sigue siendo imperativo — no hay forma de
   que no lo sea — pero está detrás de una promesa con `cancel`, que es algo que
   un `useEffect` sabe limpiar y un test sabe fingir. */

import type { QrGateway, QrScanSession } from '../domain/ports';

/* `qrcode` y `jsqr` se cargan bajo demanda, no al importar este módulo.

   No es micro-optimización: `dependencies.ts` es el composition root y lo
   importa TODO —cada caso de uso, cada slice y el helper de tests—, así que un
   import estático aquí metía las dos librerías en el arranque de cada test
   unitario (el `collect` de la suite se multiplicó por cinco) y en el chunk
   inicial del bundle. Solo hacen falta cuando el usuario abre la hoja de
   sincronizar. */
const qrcode = () => import('qrcode').then((m) => m.default);
const jsqr = () => import('jsqr').then((m) => m.default);

/** Mensajes que ve el usuario bajo el botón de escanear. Distinguir "permiso
 *  denegado" de "no hay cámara" es lo que le dice qué puede arreglar. */
export function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  const msg = name === 'NotAllowedError' ? 'Permiso de cámara denegado.'
    : name === 'NotFoundError' ? 'No se encontró una cámara.'
    : 'No se pudo abrir la cámara.';
  return `${msg} Usa archivo o texto.`;
}

export const NO_CAMERA_SUPPORT = 'Este navegador no permite usar la cámara. Usa archivo o texto.';

export const browserQrGateway: QrGateway = {
  /* Codifica lo que le den. Si cabe o no en un QR lo decide quien llama:
     `QR_BYTE_LIMIT` es un concepto de Hilo, y `shared/` no importa de
     `features/`. */
  encode: async (bytes) => {
    const QRCode = await qrcode();
    return QRCode.toDataURL([{ data: bytes, mode: 'byte' }], {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 320,
    });
  },

  scan: (video): QrScanSession => {
    let stream: MediaStream | null = null;
    let raf: number | null = null;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    };

    const result = new Promise<Uint8Array>((resolve, reject) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        reject(new Error(NO_CAMERA_SUPPORT));
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then(async (s) => {
          const jsQR = await jsqr();
          if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s;
          video.srcObject = s;
          await video.play();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          const tick = () => {
            if (stopped) return;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              // `dontInvert`: los QR de Hilo son oscuros sobre claro y probar la
              // inversión duplicaría el trabajo por cuadro.
              const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (hit && hit.binaryData && hit.binaryData.length) {
                stop();
                resolve(new Uint8Array(hit.binaryData));
                return;
              }
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        })
        .catch((e) => {
          stop();
          reject(new Error(cameraErrorMessage(e)));
        });
    });

    return { result, cancel: stop };
  },
};
