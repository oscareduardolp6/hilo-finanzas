/* Única parte de Hilo que llama a una API externa: la de Anthropic, directo
   desde el navegador con la key que el usuario pega en Ajustes (ver
   `OCR_SETTINGS_STORAGE_KEY`). No hay servidor del proyecto. Las fotos solo
   viven en memoria durante el escaneo.

   Los mensajes de error van en español y son contrato: `test/unit/receipt.test.js`
   los compara, y son lo que el usuario lee dentro de la hoja. */

import { RECEIPT_MODEL_DEFAULT } from '../domain/config';
import type { ReceiptScan } from '../domain/draft';
import type { ScanReceiptRequest, VerifyKeyRequest } from '../domain/ports';

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';

const INVALID_KEY = 'La clave de API no es válida. Revisa la de este dispositivo en Ajustes (cada dispositivo guarda la suya).';
const NO_CONNECTION = 'No hay conexión para leer el ticket.';
const UNREADABLE = 'No se pudo interpretar el ticket, intenta con otra foto.';

const headers = (apiKey: string) => ({
  'content-type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
});

const nullable = (type: 'number' | 'string', description: string) =>
  ({ anyOf: [{ type }, { type: 'null' }], description });

/* El esquema ES el contrato con el modelo: describe qué significa cada campo,
   y por eso las descripciones están redactadas con el mismo cuidado que el
   prompt. Va como salida estructurada (`output_config.format`) y no como una
   herramienta forzada: `tool_choice` de tipo `tool` da 400 en varios modelos
   actuales que el usuario puede escribir en Ajustes, y la salida estructurada
   funciona en todos (Haiku 4.5 incluido). `listPrice` ANTES de descuentos es
   la decisión central: el descuento va aparte, como ahorro del desglose.

   `categoryId` es string libre y no un `enum` de las categorías del usuario: el
   esquema se compila y se cachea, y uno distinto por usuario lo recompilaría.
   `buildReceiptDraft` ya descarta un id que no exista. */
export const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string', description: 'Nombre del comercio/tienda. Cadena vacía si no se distingue.' },
    date: { type: 'string', description: 'Fecha del ticket en formato YYYY-MM-DD. Cadena vacía si no aparece.' },
    currency: { type: 'string', description: 'Código de moneda, normalmente MXN.' },
    lineItems: {
      type: 'array',
      description: 'Un elemento por artículo comprado, en el orden del ticket y sin repetir los renglones que aparecen en dos fotos encimadas.',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Nombre del artículo tal como aparece en el ticket.' },
          listPrice: { type: 'number', description: 'Total del renglón ANTES de descuentos a nivel ticket. Si la cantidad es mayor a 1, es el total del renglón, no el unitario.' },
          quantity: nullable('number', 'Unidades (o kilos) del artículo, o null si no se indica.'),
          unitPrice: nullable('number', 'Precio por unidad si el ticket lo imprime, o null.'),
          categoryId: nullable('string', 'Id de categoría de gasto: EXACTAMENTE uno de los ids listados en el prompt, o null si ninguno encaja.'),
        },
        required: ['description', 'listPrice', 'quantity', 'unitPrice', 'categoryId'],
        additionalProperties: false,
      },
    },
    discounts: {
      type: 'array',
      description: 'Descuentos, ahorros o promociones del ticket. Montos POSITIVOS.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Nombre del descuento tal como aparece (ej. "Ahorro total", "Promo 2x1").' },
          amount: { type: 'number', description: 'Monto ahorrado, positivo.' },
        },
        required: ['label', 'amount'],
        additionalProperties: false,
      },
    },
    ticketTotal: { type: 'number', description: 'Total efectivamente pagado, tal como se imprime en el ticket. 0 si no aparece en ninguna foto.' },
  },
  required: ['store', 'date', 'currency', 'lineItems', 'discounts', 'ticketTotal'],
  additionalProperties: false,
};

/** El prompt. La parte de varias fotos es la regla del "corte": las fotos de
 *  un ticket largo se enciman, y lo que se repite en la orilla no es una
 *  segunda compra. */
export function buildReceiptPrompt(photoCount: number, catLines: string): string {
  const multi = photoCount > 1 ? [
    '',
    `Las ${photoCount} fotos son partes consecutivas de UN SOLO ticket, en orden de arriba hacia abajo, y se enciman: los últimos renglones de una foto suelen reaparecer al inicio de la siguiente.`,
    'Para cada par de fotos consecutivas, encuentra la zona de traslape alineando la SECUENCIA de renglones (descripción y precio, en orden), y registra cada renglón una sola vez.',
    'Ejemplo: si la foto 1 termina en "…, LECHE 1L 24.50, PLATANO 18.90" y la foto 2 empieza con "LECHE 1L 24.50, PLATANO 18.90, PAN BCO 42.00", esos dos primeros renglones de la foto 2 ya están contados: sigue a partir de "PAN BCO".',
    'Pero dos renglones iguales que NO están en la zona de traslape (p. ej. el mismo producto pasado dos veces por la caja, uno tras otro dentro de la misma foto) son dos compras: consérvalos.',
    'Tienda, fecha, descuentos y total son del ticket completo: tómalos una sola vez aunque aparezcan en varias fotos.',
  ] : [];
  return [
    photoCount > 1
      ? 'Analiza estas fotos de un ticket de compra (México, montos en pesos MXN).'
      : 'Analiza esta foto de un ticket de compra (México, montos en pesos MXN).',
    ...multi,
    '',
    'Devuelve:',
    '- store: el nombre del comercio.',
    '- date: la fecha del ticket en formato YYYY-MM-DD (cadena vacía si no aparece).',
    '- lineItems: un elemento por artículo, con el total de su renglón ANTES de aplicar descuentos a nivel ticket; quantity y unitPrice si el ticket los imprime.',
    '- discounts: los descuentos / ahorros / promociones, como montos POSITIVOS y por separado de los artículos.',
    '- ticketTotal: el total pagado tal como se imprime (0 si no se ve).',
    'Para categoryId de cada artículo elige EXACTAMENTE uno de estos ids (o null si ninguno encaja):',
    catLines,
  ].join('\n');
}

async function failure(res: Response): Promise<Error> {
  if (res.status === 401) return new Error(INVALID_KEY);
  if (res.status === 429) return new Error('Se alcanzó el límite de uso de tu cuenta de API.');
  let detail = '';
  try {
    const body = await res.json();
    if (body && body.error && body.error.message) detail = ` (${body.error.message})`;
  } catch { /* sin cuerpo */ }
  return new Error(`El servicio de OCR falló (código ${res.status})${detail}`);
}

type MessageResponse = {
  stop_reason?: string;
  content?: { type: string; text?: string }[];
};

export async function scanReceipt(
  { apiKey, model, images, expenseCategories }: ScanReceiptRequest,
): Promise<ReceiptScan> {
  const catLines = expenseCategories.map(c => `${c.id} — ${c.name}`).join('\n');

  // Cada foto con su etiqueta, como recomienda la guía de visión para varias
  // imágenes: el prompt habla de "la foto 1", "la foto 2".
  const imageBlocks = images.flatMap((image, i) => [
    ...(images.length > 1 ? [{ type: 'text', text: `Foto ${i + 1} de ${images.length}:` }] : []),
    { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
  ]);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        model: model || RECEIPT_MODEL_DEFAULT,
        // Un ticket de 40 artículos son miles de tokens de JSON, más el
        // razonamiento de los modelos que piensan por defecto. Con 4096 se
        // truncaba.
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
        messages: [{
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: buildReceiptPrompt(images.length, catLines) }],
        }],
      }),
    });
  } catch {
    throw new Error(NO_CONNECTION);
  }

  if (!res.ok) throw await failure(res);

  let data: MessageResponse;
  try {
    data = await res.json();
  } catch {
    throw new Error(UNREADABLE);
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('El ticket es demasiado largo para leerlo de una vez; intenta con menos fotos.');
  }
  // La respuesta puede traer bloques de razonamiento antes: se busca el texto
  // por tipo, no por posición.
  const block = (data.content || []).find(b => b.type === 'text' && b.text);
  if (!block || data.stop_reason === 'refusal') throw new Error(UNREADABLE);
  try {
    return JSON.parse(block.text!) as ReceiptScan;
  } catch {
    throw new Error(UNREADABLE);
  }
}

/** "Probar clave" de Ajustes: pide la ficha del modelo. No manda foto ni
 *  genera tokens, así que no cuesta nada, y distingue key mala de modelo mal
 *  escrito. */
export async function verifyKey({ apiKey, model }: VerifyKeyRequest): Promise<void> {
  const id = model || RECEIPT_MODEL_DEFAULT;
  let res: Response;
  try {
    res = await fetch(`${ANTHROPIC_MODELS_URL}/${encodeURIComponent(id)}`, { method: 'GET', headers: headers(apiKey) });
  } catch {
    throw new Error('No hay conexión para comprobar la clave.');
  }
  if (res.ok) return;
  if (res.status === 401) throw new Error('La clave de API no es válida.');
  if (res.status === 404) throw new Error(`El modelo «${id}» no existe; revisa cómo está escrito o deja el campo vacío.`);
  throw await failure(res);
}
