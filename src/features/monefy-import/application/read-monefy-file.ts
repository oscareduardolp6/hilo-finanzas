/* Leer el CSV que el usuario eligió y devolver la revisión, sin aplicar nada.

   Mismo reparto que en `backup`: el caso de uso lee y el usuario confirma. Aquí
   entre los dos pasos hay además decisiones que tomar (qué cuentas entran, cómo
   se llaman, si se usa la convención de Oscar), y de ahí que la hoja tenga tres
   pantallas en vez de un "¿seguro?". */

import { pipe } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import type { Deps } from '../../../app/dependencies';
import { csvParseError } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import { parseMonefyRows } from '../domain/csv';
import { buildMonefyImportPreview } from '../domain/preview';
import type { MonefyPreview } from '../domain/preview';

/* Los tres mensajes son los que enseñaba `MonefyImportModal`, literales: el
   primero le dice al usuario dónde mirar (el encabezado de columnas) y el
   segundo distingue "no es de Monefy" de "sí lo es, pero está vacío". */
const NOT_MONEFY = 'Este archivo no parece un export CSV de Monefy (revisa el encabezado de columnas).';
const NO_ROWS = 'El archivo no tiene movimientos.';
const UNREADABLE = 'No se pudo leer el archivo.';

const parse = (text: string): MonefyPreview => {
  const rows = parseMonefyRows(text);
  if (!rows) throw new Error(NOT_MONEFY);
  if (!rows.length) throw new Error(NO_ROWS);
  return buildMonefyImportPreview(rows);
};

export const readMonefyFile = (file: File): RTE.ReaderTaskEither<Deps, HiloError, MonefyPreview> =>
  pipe(
    RTE.ask<Deps>(),
    RTE.chainTaskEitherK((deps) =>
      TE.tryCatch(
        () => deps.fileGateway.readText(file).then(parse),
        (e) => csvParseError(e instanceof Error ? e.message : UNREADABLE),
      ),
    ),
  );
