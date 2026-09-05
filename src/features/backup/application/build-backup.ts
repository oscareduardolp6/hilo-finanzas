/* Armar un respaldo: la foto completa de las cinco colecciones, con el nombre
   de archivo fechado, y su versión de texto para pegar en otro lado.

   Comparte el formato con `sync` —de ahí que importe de su `domain/`— pero no
   su intención: un respaldo nunca es parcial ni lleva `device`. Quien lo lea
   va a reemplazar con él, no a fundirlo, así que mandar medio historial no
   tendría sentido. */

import * as R from 'fp-ts/Reader';
import * as RT from 'fp-ts/ReaderTask';
import type { Deps } from '../../../app/dependencies';
import type { DataState } from '../../../shared/domain/types';
import { bytesToBase64, gzipString, supportsCompression } from '../../../shared/infrastructure/compression';
import { exportFileName } from '../../../shared/infrastructure/download';
import { EXPORT_TEXT_PREFIX, buildExportPayload } from '../../sync/domain/payload';
import type { ExportPayload } from '../../sync/domain/payload';

export type Backup = {
  readonly payload: ExportPayload;
  readonly json: string;
  /** `hilo-respaldo-AAAA-MM-DD.json`, fechado con el reloj inyectado. */
  readonly fileName: string;
};

/** Determinista salvo por el reloj, que entra por `Deps`: de ahí `Reader`. */
export const buildBackup =
  (state: DataState): R.Reader<Deps, Backup> =>
  (deps) => {
    const payload = buildExportPayload(state, { now: deps.clock() });
    return { payload, json: JSON.stringify(payload), fileName: exportFileName('respaldo', deps.clock()) };
  };

/** El texto copiable: `hilo1:<base64 gzip>`, o el JSON plano si el navegador no
 *  comprime. `null` = no se pudo preparar y no hay nada que copiar — comprimir
 *  es lo único que puede fallar aquí, y fallar significa quedarse sin texto,
 *  no copiar uno a medias. */
export const backupText =
  (state: DataState): RT.ReaderTask<Deps, string | null> =>
  (deps) =>
  async () => {
    const { json } = buildBackup(state)(deps);
    if (!supportsCompression()) return json;
    try {
      return EXPORT_TEXT_PREFIX + bytesToBase64(await gzipString(json));
    } catch {
      return null;
    }
  };
