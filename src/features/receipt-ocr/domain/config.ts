/* El modelo que se usa cuando el usuario no elige uno.

   Vive en `domain/` y no junto al `fetch` porque lo leen dos features: la
   infraestructura como fallback del request, y `settings` como placeholder del
   campo. La regla de dependencias permite el `domain/` de otra feature, no su
   `infrastructure/`. */

/** Haiku por defecto: es el más barato, y para un ticket alcanza. */
export const RECEIPT_MODEL_DEFAULT = 'claude-haiku-4-5';
