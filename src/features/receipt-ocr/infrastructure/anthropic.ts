/* Única parte de Hilo que llama a una API externa: la de Anthropic, directo
   desde el navegador con la key que el usuario pega en Ajustes (ver
   `OCR_SETTINGS_STORAGE_KEY`). No hay servidor del proyecto. La foto solo vive
   en memoria durante el escaneo.

   Los mensajes de error van en español y son contrato: `test/unit/receipt.test.js`
   los compara literalmente, y son lo que el usuario lee dentro de la hoja. */

import type { ReceiptScan } from '../domain/draft';
import type { ScanReceiptRequest } from '../domain/ports';

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const RECEIPT_MODEL_DEFAULT = 'claude-haiku-4-5';

/* El esquema de la herramienta ES el contrato con el modelo: describe qué
   significa cada campo, y por eso las descripciones están redactadas con el
   mismo cuidado que el prompt. `listPrice` ANTES de descuentos es la decisión
   central — ver `to-transactions.ts`. */
const RECEIPT_TOOL = {
  name: 'emit_receipt',
  description: 'Devuelve los datos estructurados de un ticket de compra de supermercado.',
  input_schema: {
    type: 'object',
    properties: {
      store: { type: 'string', description: 'Nombre del comercio/tienda. Cadena vacía si no se distingue.' },
      date: { type: 'string', description: 'Fecha del ticket en formato YYYY-MM-DD. Cadena vacía si no aparece.' },
      currency: { type: 'string', description: 'Código de moneda, normalmente MXN.' },
      lineItems: {
        type: 'array',
        description: 'Un elemento por artículo comprado.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Nombre del artículo tal como aparece en el ticket.' },
            listPrice: { type: 'number', description: 'Precio del renglón ANTES de descuentos a nivel ticket. Si la cantidad es mayor a 1, es el total del renglón.' },
            quantity: { type: ['number', 'null'], description: 'Unidades del artículo, o null si no se indica.' },
            categoryId: { type: ['string', 'null'], description: 'Id de categoría de gasto: EXACTAMENTE uno de los ids listados en el prompt, o null si ninguno encaja.' },
          },
          required: ['description', 'listPrice'],
        },
      },
      discounts: {
        type: 'array',
        description: 'Descuentos, ahorros o promociones aplicados al total del ticket. Montos POSITIVOS.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Nombre del descuento tal como aparece (ej. "Ahorro total", "Promo 2x1").' },
            amount: { type: 'number', description: 'Monto ahorrado, positivo.' },
          },
          required: ['label', 'amount'],
        },
      },
      ticketTotal: { type: 'number', description: 'Total efectivamente pagado, tal como se imprime en el ticket.' },
    },
    required: ['store', 'date', 'lineItems', 'discounts', 'ticketTotal'],
  },
};

export async function scanReceipt(
  { apiKey, model, image, expenseCategories }: ScanReceiptRequest,
): Promise<ReceiptScan> {
  const catLines = expenseCategories.map(c => `${c.id} — ${c.name}`).join('\n');
  const prompt = [
    'Analiza esta foto de un ticket de compra de supermercado (México, montos en pesos MXN).',
    'Devuelve, usando la herramienta emit_receipt:',
    '- store: el nombre del comercio.',
    '- date: la fecha del ticket en formato YYYY-MM-DD (cadena vacía si no aparece).',
    '- lineItems: un elemento por artículo, con su precio de renglón ANTES de aplicar descuentos a nivel ticket.',
    '- discounts: los descuentos / ahorros / promociones aplicados al total, como montos POSITIVOS y por separado.',
    '- ticketTotal: el total pagado tal como se imprime.',
    'Para categoryId de cada artículo elige EXACTAMENTE uno de estos ids (o null si ninguno encaja):',
    catLines,
  ].join('\n');

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || RECEIPT_MODEL_DEFAULT,
        max_tokens: 4096,
        tools: [RECEIPT_TOOL],
        tool_choice: { type: 'tool', name: 'emit_receipt' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
  } catch {
    throw new Error('No hay conexión para leer el ticket.');
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('La clave de API no es válida.');
    if (res.status === 429) throw new Error('Se alcanzó el límite de uso de tu cuenta de API.');
    let detail = '';
    try {
      const body = await res.json();
      if (body && body.error && body.error.message) detail = ` (${body.error.message})`;
    } catch { /* sin cuerpo */ }
    throw new Error(`El servicio de OCR falló (código ${res.status})${detail}`);
  }

  let data: { content?: { type: string; input?: ReceiptScan }[] };
  try {
    data = await res.json();
  } catch {
    throw new Error('No se pudo interpretar el ticket, intenta con otra foto.');
  }
  const block = (data.content || []).find(b => b.type === 'tool_use');
  if (!block || !block.input) throw new Error('No se pudo interpretar el ticket, intenta con otra foto.');
  return block.input;
}
