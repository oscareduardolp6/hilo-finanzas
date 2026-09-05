/* Compresión con las APIs nativas del navegador (`CompressionStream`), sin
   librería. Es lo que hace que un dataset quepa en un QR y que el texto que se
   copia sea manejable.

   Vive en `shared/` y no en `sync/` porque no sabe nada de Hilo: comprime un
   string y descomprime bytes. `supportsCompression` existe porque el soporte no
   es universal y la UI degrada a "usa el archivo" cuando falta. */

export function supportsCompression(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

export async function gzipString(str: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function gunzipBytes(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
