/* Leer el CSV que exporta Monefy. Todo esto es dominio: transformaciones de
   texto a datos, sin IO — el archivo lo lee el gateway y aquí solo llega su
   contenido.

   El parser de CSV es propio (y no una librería) porque el formato de Monefy es
   el mínimo: comillas dobles escapadas duplicándolas, comas, saltos de línea.
   Se trasladó verbatim del legacy. */

export const MONEFY_HEADER_PREFIX = ['date', 'account', 'category', 'amount'];
const MONEFY_TO_RE = /^To '(.+)'$/;
const MONEFY_FROM_RE = /^From '(.+)'$/;
const MONEFY_INITIAL_RE = /^Initial balance '(.+)'$/;

/** Monefy no tiene "transferencia": la parte que sale y la que entra son dos
 *  renglones con la otra cuenta escrita en la columna de categoría. */
export const MONEFY_TRANSFER_CATEGORY = 'Transferencias';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') { continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/** `DD/MM/AAAA` → `AAAA-MM-DD`, que es como Hilo guarda las fechas. */
export function parseMonefyDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  // Los `!` mantienen el comportamiento del legacy: una fecha sin barras
  // revienta aquí en vez de producir una fecha inventada.
  return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
}

export function parseMonefyAmount(str: string | number): number {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

/** Qué es en realidad la columna "categoría" de un renglón: casi siempre una
 *  categoría, pero también la pata de una transferencia o un saldo inicial. */
export type MonefyClassification =
  | { kind: 'to'; otherAccount: string }
  | { kind: 'from'; otherAccount: string }
  | { kind: 'initial'; otherAccount: string }
  | { kind: 'plain'; category: string };

export function classifyMonefyCategory(raw: string): MonefyClassification {
  const trimmed = (raw || '').trim();
  let m = trimmed.match(MONEFY_TO_RE);
  if (m) return { kind: 'to', otherAccount: m[1]!.trim() };
  m = trimmed.match(MONEFY_FROM_RE);
  if (m) return { kind: 'from', otherAccount: m[1]!.trim() };
  m = trimmed.match(MONEFY_INITIAL_RE);
  if (m) return { kind: 'initial', otherAccount: m[1]!.trim() };
  return { kind: 'plain', category: trimmed };
}

export type MonefyRow = {
  date: string;
  account: string;
  amount: number;
  description: string;
} & MonefyClassification;

/** `null` = el archivo no es un export de Monefy (encabezado que no cuadra).
 *  Un array vacío sí lo es, pero sin movimientos: son dos casos distintos y la
 *  UI los distingue con dos mensajes. */
export function parseMonefyRows(text: string): MonefyRow[] | null {
  const table = parseCsv(text.replace(/^\ufeff/, ''));
  if (!table.length) return null;
  const header = table[0]!.map(h => h.trim().toLowerCase());
  const headerOk = MONEFY_HEADER_PREFIX.every((h, idx) => header[idx] === h);
  if (!headerOk) return null;
  const rows: MonefyRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    if (!cols || cols.length < 4 || (cols.length === 1 && cols[0] === '')) continue;
    const date = (cols[0] || '').trim();
    const account = (cols[1] || '').trim();
    const amount = parseMonefyAmount(cols[3]!);
    const description = (cols[7] || '').trim();
    if (!date || !account) continue;
    rows.push({ date: parseMonefyDate(date), account, amount, description, ...classifyMonefyCategory(cols[2]!) });
  }
  return rows;
}
