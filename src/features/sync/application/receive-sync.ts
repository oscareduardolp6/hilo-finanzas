/* Recibir datos de otro dispositivo: leer el payload, fundirlo y anotar el peer.

   Es el primer `ReaderTaskEither` de una feature — async porque descomprimir lo
   es, y falible porque lo que llega es texto que pegó el usuario o bytes que
   leyó una cámara. El `Either` muere en el slice, como todos. */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import type { Deps } from '../../../app/dependencies';
import { invalidPayload } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import type { DataState, SyncState } from '../../../shared/domain/types';
import { mergeDataState } from '../domain/merge';
import type { IncomingPayload } from '../domain/payload';
import { parseExportBytes, parseExportText } from '../domain/payload';
import { recordPeerReceive, syncSummaryToast } from '../domain/peers';

/** De dónde vino lo que hay que leer. El QR llega como bytes ya crudos; el
 *  archivo y el texto pegado, como string. */
export type IncomingSource =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array };

export type ReceiveResult = {
  readonly data: DataState;
  /** `null` si no hubo peer que anotar (export viejo, o de este mismo aparato). */
  readonly syncState: SyncState | null;
  readonly toast: string;
};

/* Los mensajes de error vienen ya en español desde `normalizeExportPayload` y
   `parseExport*`, así que se pasan tal cual: son lo que el usuario lee bajo el
   cuadro de texto. `messageFor` los devuelve intactos para `InvalidPayload`. */
const parse = (source: IncomingSource): TE.TaskEither<HiloError, IncomingPayload> =>
  TE.tryCatch(
    () => (source.kind === 'text' ? parseExportText(source.text) : parseExportBytes(source.bytes)),
    (e) => invalidPayload(e instanceof Error ? e.message : 'No se pudo leer el archivo.'),
  );

export const receiveSync = (
  current: DataState,
  syncState: SyncState | null,
  source: IncomingSource,
): RTE.ReaderTaskEither<Deps, HiloError, ReceiveResult> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      pipe(
        parse(source),
        TE.map((incoming): ReceiveResult => {
          const now = deps.clock();
          const merged = mergeDataState(current, incoming, now);
          // Un `exportedAt` ilegible cae al reloj: preferimos anotar un punto
          // aproximado a no anotar ninguno y volver a mandarlo todo.
          const at = Date.parse(incoming.exportedAt || '') || now;
          const nextSync = recordPeerReceive(syncState, incoming.device, at);
          const who = nextSync && incoming.device ? (incoming.device.name || '') : '';
          const { stats, ...data } = merged;
          return { data, syncState: nextSync, toast: syncSummaryToast(stats, who, incoming.partial) };
        }),
      ),
    ),
  );
