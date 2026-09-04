/* Canal de error de los casos de uso. Los que tocan IO devuelven
   `Either<HiloError, A>` en vez de lanzar, así el tipo dice qué puede fallar.
   El `match` ocurre en el slice de zustand — el único punto de run.

   IMPORTANTE: los textos que devuelve `messageFor` son contrato de test. Los
   assertions de `test/integration/` y `test/unit/receipt.test.js` los comparan
   literalmente; cambiarlos rompe la suite (y, antes que eso, la UI en español). */

export type HiloError =
  | { readonly _tag: 'PersistenceError'; readonly cause: unknown }
  | { readonly _tag: 'InvalidPayload'; readonly message: string }
  | { readonly _tag: 'ReceiptApiError'; readonly status: number; readonly message: string }
  | { readonly _tag: 'CsvParseError'; readonly message: string }
  | { readonly _tag: 'CameraUnavailable'; readonly cause: unknown };

export const persistenceError = (cause: unknown): HiloError => ({ _tag: 'PersistenceError', cause });

export const invalidPayload = (message: string): HiloError => ({ _tag: 'InvalidPayload', message });

export const receiptApiError = (status: number, message: string): HiloError => ({
  _tag: 'ReceiptApiError',
  status,
  message,
});

export const csvParseError = (message: string): HiloError => ({ _tag: 'CsvParseError', message });

export const cameraUnavailable = (cause: unknown): HiloError => ({ _tag: 'CameraUnavailable', cause });

/** Texto que ve el usuario en el toast. */
export const messageFor = (error: HiloError): string => {
  switch (error._tag) {
    // El único fallo de persistencia que hoy llega a la UI es el de guardado; la
    // hidratación fallida se traga a propósito y deja los datos de ejemplo.
    case 'PersistenceError':
      return 'No se pudo guardar el cambio localmente';
    case 'CameraUnavailable':
      return 'No se pudo abrir la cámara';
    // Estos tres ya traen su mensaje en español desde donde se construyeron
    // (p. ej. `scanReceipt` mapea 401/429 a su texto).
    case 'InvalidPayload':
    case 'ReceiptApiError':
    case 'CsvParseError':
      return error.message;
  }
};
