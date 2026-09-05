/* Preparar lo que se va a mandar: el payload, su texto comprimido y, si cabe,
   el QR. Era un `useEffect` de 30 líneas dentro de `SyncModal` con un flag de
   `cancelled`; ahora es un valor que el slice corre y el container decide si
   todavía quiere.

   Nunca falla de cara al usuario: si el navegador no comprime o el QR no sale,
   se devuelve un preview sin QR y sin texto, y la UI ofrece el archivo. Por eso
   es `ReaderTask` y no `ReaderTaskEither` — quedarse sin QR no es un error, es
   un historial grande. */

import * as RT from 'fp-ts/ReaderTask';
import type { Deps } from '../../../app/dependencies';
import type { DataState } from '../../../shared/domain/types';
import { bytesToBase64, gzipString, supportsCompression } from '../../../shared/infrastructure/compression';
import { EXPORT_TEXT_PREFIX, QR_BYTE_LIMIT, buildExportPayload, countPayloadRecords } from '../domain/payload';
import type { ExportDevice, ExportPayload } from '../domain/payload';

export type SharePreview = {
  readonly payload: ExportPayload;
  readonly json: string;
  /** Cuántos registros lleva; la UI lo muestra al mandar solo lo nuevo. */
  readonly count: number;
  /** Epoch desde el que va el delta, o `null` si es la foto completa. */
  readonly since: number | null;
  /** `hilo1:…` listo para copiar, o `''` si el navegador no comprime. */
  readonly text: string;
  /** Tamaño comprimido, para el aviso de "N KB no caben en un QR". */
  readonly bytes: number | null;
  /** Data URL del QR, o `null` si no cabe o no se pudo generar. */
  readonly qrDataUrl: string | null;
};

export type ShareOptions = {
  readonly device?: ExportDevice | undefined;
  readonly since?: number | undefined;
};

export const prepareShare =
  (state: DataState, { device, since }: ShareOptions): RT.ReaderTask<Deps, SharePreview> =>
  (deps) =>
  async () => {
    const payload = buildExportPayload(state, { device, since, now: deps.clock() });
    const json = JSON.stringify(payload);
    const base = { payload, json, count: countPayloadRecords(payload), since: payload.since };

    if (!supportsCompression()) return { ...base, text: '', bytes: null, qrDataUrl: null };

    try {
      const bytes = await gzipString(json);
      const text = EXPORT_TEXT_PREFIX + bytesToBase64(bytes);
      // El límite es de Hilo, no del navegador: se decide aquí y no en el
      // gateway, que codifica lo que le den.
      const qrDataUrl = bytes.length <= QR_BYTE_LIMIT ? await deps.qrGateway.encode(bytes) : null;
      return { ...base, text, bytes: bytes.length, qrDataUrl };
    } catch {
      return { ...base, text: '', bytes: null, qrDataUrl: null };
    }
  };
