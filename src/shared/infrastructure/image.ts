/* Preparar una foto para mandarla: reescalarla y codificarla en base64.

   Vive en `shared/` y no en `receipt-ocr/` por lo mismo que `compression.ts` y
   `download.ts`: no sabe nada de Hilo. Una encoge una imagen con un `<canvas>`
   y la otra la lee con un `FileReader`; ninguna sabe qué es un ticket. */

/** Una imagen lista para un mensaje de la API: tipo MIME + base64 sin cabecera. */
export type EncodedImage = {
  media_type: string;
  data: string;
};

export function fileToBase64(blob: Blob): Promise<EncodedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      const header = comma >= 0 ? result.slice(0, comma) : '';
      const match = header.match(/data:([^;]+)/);
      resolve({
        media_type: match ? match[1]! : (blob.type || 'image/jpeg'),
        data: comma >= 0 ? result.slice(comma + 1) : result,
      });
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

/* Reescala a JPEG con lado máximo `maxDim` para bajar peso y costo de la API
   y normalizar formatos raros (HEIC/webp). Devuelve el archivo original si ya
   es un JPEG chico o si el navegador no puede decodificar la imagen. */
export function downscaleImage(file: File, maxDim = 1600): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, maxDim / longest);
      if (scale === 1 && file.type === 'image/jpeg' && file.size < 3 * 1024 * 1024) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
