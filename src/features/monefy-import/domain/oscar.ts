/* Convención personal de Oscar en Monefy (opcional, no es un feature de
   Monefy): "Base (N/D)" marca el progreso de un pago a meses (él lleva sus
   cuentas quincenales, así que un pago cuenta como medio "mes"), y todo lo
   que sigue -por guiones- son "lugar - tamaño - marca - cantidad". Ambos
   patrones comparten el mismo separador, así que una sola función cubre los
   dos casos (con y sin fracción).

   Vive en su propio módulo justamente por eso: es la única parte del import
   que NO es sobre Monefy, y la UI deja apagarla con un switch. */

const OSCAR_FRACTION_RE = /[(\[]\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)\s*[)\]]/;

export type OscarParsed = {
  description: string;
  store: string;
  size: string;
  brand: string;
  quantity: string;
  /** Pago N de D. `null` si la descripción no traía fracción. */
  numerator: number | null;
  denominator: number | null;
};

export function parseOscarDescription(raw: string): OscarParsed {
  const text = raw || '';
  const m = text.match(OSCAR_FRACTION_RE);
  let base: string;
  let rest: string;
  let numerator: number | null = null;
  let denominator: number | null = null;
  if (m) {
    base = text.slice(0, m.index).trim();
    rest = text.slice(m.index! + m[0].length).replace(/^[\s-]+/, '').trim();
    numerator = parseFloat(m[1]!);
    denominator = parseInt(m[2]!, 10);
  } else {
    const parts = text.split(' - ');
    base = parts[0]!.trim();
    rest = parts.slice(1).join(' - ').trim();
  }
  const [store, size, brand, quantity] = rest ? rest.split(' - ').map(s => s.trim()).filter(Boolean) : [];
  return {
    description: base || text.trim(),
    store: store || '', size: size || '', brand: brand || '', quantity: quantity || '',
    numerator, denominator,
  };
}
