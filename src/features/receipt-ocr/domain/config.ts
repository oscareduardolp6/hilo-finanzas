/* El modelo que se usa cuando el usuario no elige uno.

   Vive en `domain/` y no junto al `fetch` porque lo leen dos features: la
   infraestructura como fallback del request, y `settings` como placeholder del
   campo. La regla de dependencias permite el `domain/` de otra feature, no su
   `infrastructure/`. */

/** Haiku 5.5 por defecto: el más barato, y lee las fotos a alta resolución
 *  (2576 px de lado largo, contra 1568 de Haiku 4.5) — lo que más pesa para
 *  la letra chica de un ticket largo. */
export const RECEIPT_MODEL_DEFAULT = 'claude-haiku-5-5';

/** Fotos por ticket. Muy por debajo del límite del API (más de 20 imágenes
 *  endurece el tope de pixeles); un ticket de súper largo cabe en 3–4. */
export const MAX_RECEIPT_PHOTOS = 8;
