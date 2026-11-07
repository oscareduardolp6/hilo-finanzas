/* Normalizar la config del escaneo de tickets antes de guardarla o probarla.

   Vive en `shared/` porque la usan dos features: `settings` al guardar y
   `receipt-ocr` al probar la clave — y una feature no puede importar la capa
   `application/` de otra. */

import type { OcrSettings } from './types';

/* Espacios, saltos de línea y caracteres invisibles (NBSP, zero-width, BOM).
   Una key de Anthropic nunca los lleva, pero copiarla en el teléfono —de un
   chat, de una nota, con el portapapeles del teclado— puede colarlos en medio,
   y el campo enmascarado no deja verlos: la API responde 401 sin más. */
const NOT_PART_OF_A_KEY = /[\s\u00A0\u200B-\u200D\u2060\uFEFF]/g;

/** `'  sk-ant…(zero-width)…  '` → `'sk-ant……'`. Lo que se guarda es lo que se manda a la API. */
export const cleanOcrSettings = (input: Partial<OcrSettings>): OcrSettings => ({
  apiKey: (input.apiKey || '').replace(NOT_PART_OF_A_KEY, ''),
  model: (input.model || '').trim(),
});
