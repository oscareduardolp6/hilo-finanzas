import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, X, ArrowRightLeft, Landmark,
  TrendingUp, MoreHorizontal,
  Settings, Receipt, LayoutGrid, Link2, Trash2,
  Check, Layers, Smartphone,
  QrCode, Camera, Download, Share2, RefreshCw, DatabaseBackup, ScanLine,
} from 'lucide-react';

/* Migrado a la capa `shared` (paso 1 de agents/plans/layered-architecture.md).
   Este archivo ya solo los consume; el barrel los re-exporta desde su nuevo
   hogar, así que los tests no se enteran del movimiento. */
import { COLORS, CATEGORY_PALETTE, ACCOUNT_SEARCH_THRESHOLD, DESKTOP_BREAKPOINT } from '../shared/design/tokens';
import { ICONS, ICON_CHOICES, IconFor, ACCOUNT_TYPES } from '../shared/design/icons';
import { uid } from '../shared/domain/ids';
import { todayIso, formatDateLabel } from '../shared/domain/dates';
import { formatMoney } from '../shared/domain/money';
import { accountNameMatches } from '../shared/domain/search';
import { highlightMatch } from '../shared/ui/highlight';
import { SheetOverlay } from '../shared/ui/sheet-overlay';
import { saveOcrSettings } from '../shared/infrastructure/indexed-db';

/* Feature `accounts`, migrada en el paso 3. */
import { AccountsContainer } from '../features/accounts/ui/containers/AccountsContainer';
import { AccountFormContainer } from '../features/accounts/ui/containers/AccountFormContainer';

/* Feature `transactions`, paso 4. El alta, la edición y el borrado son acciones
   del store, y la hoja se monta por container. */
import { AddTransactionContainer } from '../features/transactions/ui/containers/AddTransactionContainer';

/* Feature `installments`, paso 5. */
import { MsiContainer } from '../features/installments/ui/containers/MsiContainer';
import { MsiPlanFormContainer } from '../features/installments/ui/containers/MsiPlanFormContainer';

/* Feature `dashboard`, paso 6: Inicio, la dona y los totales del mes. */
import { HomeContainer } from '../features/dashboard/ui/containers/HomeContainer';

/* Feature `history`, paso 7: filtros y buscador. Con ella se van los dos
   últimos `useMemo` de `AppBody`, que ya no deriva absolutamente nada. */
import { HistoryContainer } from '../features/history/ui/containers/HistoryContainer';

/* Features `sync` (paso 8) y `backup` (paso 9): comparten el formato del
   payload, y de las dos ya no queda nada en este archivo. */
import { SyncContainer } from '../features/sync/ui/containers/SyncContainer';
import { BackupContainer } from '../features/backup/ui/containers/BackupContainer';

/* Componentes presentacionales compartidos por varias features: por la regla de
   dependencias no pueden vivir en ninguna de ellas. */
import { CategoryPicker } from '../shared/ui/category-picker';
import { StoreInput } from '../shared/ui/store-input';
import { AccountChips } from '../shared/ui/account-chips';

/* El estado dejó de vivir en `App`: ahora está en el store de zustand, que se
   crea por montaje. Ver src/app/store/ y agents/plans/layered-architecture.md. */
import { HiloStoreProvider, useHiloStore } from '../app/store-context';
import { useToastAutoDismiss } from '../app/use-toast-auto-dismiss';

/* Config del escaneo de tickets. La clave de IndexedDB donde vive
   (`OCR_SETTINGS_STORAGE_KEY`) está en shared/infrastructure/indexed-db.ts. */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const RECEIPT_MODEL_DEFAULT = 'claude-haiku-4-5';

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: LayoutGrid },
  { id: 'history', label: 'Historial', icon: Receipt },
  { id: 'msi', label: 'MSI', icon: Layers },
  { id: 'accounts', label: 'Cuentas', icon: Landmark },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

/* ------------------------------------------------------------------ */
/* Importación de Monefy                                               */
/* ------------------------------------------------------------------ */
/* Convierte el CSV export de Monefy (columnas: date,account,category,
   amount,currency,converted amount,currency,description) en cuentas/
   categorías/transacciones de Hilo. Monefy no trae tipo de cuenta ni
   ícono de categoría (se adivinan por nombre), y codifica cada
   transferencia como dos filas separadas — "To 'X'" en la cuenta
   origen y "From 'Y'" en la cuenta destino, mismo día y monto — que
   hay que reconstruir como un solo movimiento de tipo transfer. */

const MONEFY_HEADER_PREFIX = ['date', 'account', 'category', 'amount'];
const MONEFY_TO_RE = /^To '(.+)'$/;
const MONEFY_FROM_RE = /^From '(.+)'$/;
const MONEFY_INITIAL_RE = /^Initial balance '(.+)'$/;
const MONEFY_TRANSFER_CATEGORY = 'Transferencias';

export function parseCsv(text) {
  const rows = [];
  let row = [];
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

export function parseMonefyDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseMonefyAmount(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

export function classifyMonefyCategory(raw) {
  const trimmed = (raw || '').trim();
  let m = trimmed.match(MONEFY_TO_RE);
  if (m) return { kind: 'to', otherAccount: m[1].trim() };
  m = trimmed.match(MONEFY_FROM_RE);
  if (m) return { kind: 'from', otherAccount: m[1].trim() };
  m = trimmed.match(MONEFY_INITIAL_RE);
  if (m) return { kind: 'initial', otherAccount: m[1].trim() };
  return { kind: 'plain', category: trimmed };
}

export function parseMonefyRows(text) {
  const table = parseCsv(text.replace(/^﻿/, ''));
  if (!table.length) return null;
  const header = table[0].map(h => h.trim().toLowerCase());
  const headerOk = MONEFY_HEADER_PREFIX.every((h, idx) => header[idx] === h);
  if (!headerOk) return null;
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const cols = table[i];
    if (!cols || cols.length < 4 || (cols.length === 1 && cols[0] === '')) continue;
    const date = (cols[0] || '').trim();
    const account = (cols[1] || '').trim();
    const amount = parseMonefyAmount(cols[3]);
    const description = (cols[7] || '').trim();
    if (!date || !account) continue;
    rows.push({ date: parseMonefyDate(date), account, amount, description, ...classifyMonefyCategory(cols[2]) });
  }
  return rows;
}

const MONEFY_ACCOUNT_TYPE_HINTS = [
  { type: 'efectivo', keywords: ['efectivo', 'cash'] },
  { type: 'credito', keywords: ['crédito', 'credito', 'tdc'] },
  { type: 'inversion', keywords: ['inversión', 'inversion', 'cetes'] },
  { type: 'ahorro', keywords: ['ahorro', 'apartado', 'fondo'] },
];

export function guessAccountType(name) {
  const lower = name.toLowerCase();
  for (const { type, keywords } of MONEFY_ACCOUNT_TYPE_HINTS) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'debito';
}

const MONEFY_CATEGORY_ICON_HINTS = [
  { icon: 'UtensilsCrossed', keywords: ['comida', 'restaurante', 'súper', 'super', 'snack'] },
  { icon: 'Coffee', keywords: ['cafeter', 'café', 'cafe'] },
  { icon: 'Fuel', keywords: ['gasolina'] },
  { icon: 'Car', keywords: ['coche', 'transporte', 'uber', 'estacionamiento', 'caseta'] },
  { icon: 'Home', keywords: ['renta', 'casa'] },
  { icon: 'HeartPulse', keywords: ['salud', 'enfermedad', 'terapia'] },
  { icon: 'Sparkles', keywords: ['belleza', 'spa', 'higiene'] },
  { icon: 'Film', keywords: ['entretenimiento', 'x box', 'cardistry', 'magia', 'apuesta'] },
  { icon: 'Shirt', keywords: ['ropa'] },
  { icon: 'GraduationCap', keywords: ['escuela', 'educaci', 'beca'] },
  { icon: 'PawPrint', keywords: ['mascota', 'ganado'] },
  { icon: 'Gift', keywords: ['regalo'] },
  { icon: 'ShoppingBag', keywords: ['compra', 'computadora', 'software'] },
  { icon: 'Wallet', keywords: ['sueldo', 'salario', 'prestacion', 'prestación'] },
  { icon: 'Briefcase', keywords: ['trabajo', 'freelance', 'proservicio'] },
  { icon: 'TrendingUp', keywords: ['inversion', 'inversión', 'ahorro', 'financiero', 'banco'] },
  { icon: 'RotateCcw', keywords: ['reembolso', 'descuento', 'devolucion', 'devolución'] },
  { icon: 'Plane', keywords: ['viaje', 'vacacion', 'vacación', 'hospedaje'] },
  { icon: 'Dumbbell', keywords: ['gym', 'deporte', 'alberca'] },
  { icon: 'Wrench', keywords: ['herramienta', 'tramite', 'trámite'] },
  { icon: 'Smartphone', keywords: ['telefon'] },
];

export function guessCategoryIcon(name) {
  const lower = name.toLowerCase();
  for (const { icon, keywords } of MONEFY_CATEGORY_ICON_HINTS) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return 'MoreHorizontal';
}

/* Convención personal de Oscar en Monefy (opcional, no es un feature de
   Monefy): "Base (N/D)" marca el progreso de un pago a meses (él lleva sus
   cuentas quincenales, así que un pago cuenta como medio "mes"), y todo lo
   que sigue -por guiones- son "lugar - tamaño - marca - cantidad". Ambos
   patrones comparten el mismo separador, así que una sola función cubre los
   dos casos (con y sin fracción). */
const OSCAR_FRACTION_RE = /[(\[]\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)\s*[)\]]/;

export function parseOscarDescription(raw) {
  const text = raw || '';
  const m = text.match(OSCAR_FRACTION_RE);
  let base, rest, numerator = null, denominator = null;
  if (m) {
    base = text.slice(0, m.index).trim();
    rest = text.slice(m.index + m[0].length).replace(/^[\s-]+/, '').trim();
    numerator = parseFloat(m[1]);
    denominator = parseInt(m[2], 10);
  } else {
    const parts = text.split(' - ');
    base = parts[0].trim();
    rest = parts.slice(1).join(' - ').trim();
  }
  const [store, size, brand, quantity] = rest ? rest.split(' - ').map(s => s.trim()).filter(Boolean) : [];
  return { description: base || text.trim(), store: store || '', size: size || '', brand: brand || '', quantity: quantity || '', numerator, denominator };
}

export function buildMonefyImportPreview(rows) {
  const accountsByName = new Map();
  function ensureAccount(name, appearsDirectly) {
    let entry = accountsByName.get(name);
    if (!entry) {
      entry = { name, suggestedType: guessAccountType(name), isGhost: !appearsDirectly };
      accountsByName.set(name, entry);
    } else if (appearsDirectly) {
      entry.isGhost = false;
    }
    return entry;
  }

  const initialBalances = new Map();
  const plain = [];
  const toRows = [];
  const fromRows = [];
  let minDate = null;
  let maxDate = null;

  for (const row of rows) {
    ensureAccount(row.account, true);
    if (!minDate || row.date < minDate) minDate = row.date;
    if (!maxDate || row.date > maxDate) maxDate = row.date;
    if (row.kind === 'initial') {
      initialBalances.set(row.account, row.amount);
    } else if (row.kind === 'to') {
      ensureAccount(row.otherAccount, false);
      toRows.push(row);
    } else if (row.kind === 'from') {
      ensureAccount(row.otherAccount, false);
      fromRows.push(row);
    } else {
      plain.push({ date: row.date, accountName: row.account, categoryName: row.category, type: row.amount < 0 ? 'expense' : 'income', amount: row.amount, description: row.description, _idx: plain.length, oscarParsed: parseOscarDescription(row.description) });
    }
  }

  const msiSeries = new Map();
  const seriesRows = new Map();
  for (const p of plain) {
    if (p.type !== 'expense' || p.oscarParsed.numerator == null) continue;
    const key = `${p.accountName}||${p.oscarParsed.description.toLowerCase()}||${p.oscarParsed.denominator}`;
    if (!seriesRows.has(key)) seriesRows.set(key, []);
    seriesRows.get(key).push(p);
  }
  for (const [key, entries] of seriesRows) {
    entries.sort((a, b) => a.date.localeCompare(b.date) || a._idx - b._idx);
    const categoryCounts = new Map();
    for (const e of entries) categoryCounts.set(e.categoryName, (categoryCounts.get(e.categoryName) || 0) + 1);
    let categoryName = entries[0].categoryName;
    let bestCount = 0;
    for (const [c, n] of categoryCounts) { if (n > bestCount) { bestCount = n; categoryName = c; } }
    let store = '';
    for (const e of entries) { if (e.oscarParsed.store) { store = e.oscarParsed.store; break; } }
    const paidSoFar = entries.reduce((s, e) => s + Math.abs(e.amount), 0);
    const finalNumerator = entries[entries.length - 1].oscarParsed.numerator;
    const denominator = entries[0].oscarParsed.denominator;
    const totalAmount = finalNumerator > 0 ? paidSoFar * denominator / finalNumerator : paidSoFar;
    msiSeries.set(key, { accountName: entries[0].accountName, description: entries[0].oscarParsed.description, store, categoryName, installmentsCount: denominator, totalAmount, startDate: entries[0].date });
    for (const e of entries) e._msiSeriesKey = key;
  }

  function pairKey(date, amount, fromName, toName) {
    return `${date}|${Math.abs(amount)}|${fromName}|${toName}`;
  }

  const toQueues = new Map();
  for (const row of toRows) {
    const key = pairKey(row.date, row.amount, row.account, row.otherAccount);
    if (!toQueues.has(key)) toQueues.set(key, []);
    toQueues.get(key).push(row);
  }

  const transfers = [];
  const degraded = [];
  for (const row of fromRows) {
    const key = pairKey(row.date, row.amount, row.otherAccount, row.account);
    const queue = toQueues.get(key);
    if (queue && queue.length) {
      const toRow = queue.shift();
      transfers.push({ date: row.date, fromName: row.otherAccount, toName: row.account, amount: Math.abs(row.amount), description: row.description || toRow.description });
    } else {
      degraded.push({ date: row.date, accountName: row.account, categoryName: MONEFY_TRANSFER_CATEGORY, type: 'income', amount: Math.abs(row.amount), description: row.description, oscarParsed: parseOscarDescription(row.description) });
    }
  }
  for (const queue of toQueues.values()) {
    for (const row of queue) {
      degraded.push({ date: row.date, accountName: row.account, categoryName: MONEFY_TRANSFER_CATEGORY, type: 'expense', amount: Math.abs(row.amount), description: row.description, oscarParsed: parseOscarDescription(row.description) });
    }
  }

  return {
    accounts: Array.from(accountsByName.values()).sort((a, b) => a.name.localeCompare(b.name)),
    dateRange: { min: minDate, max: maxDate },
    transactionCount: plain.length + degraded.length + transfers.length,
    transferCount: transfers.length,
    initialBalances,
    skeleton: { plain: [...plain, ...degraded], transfers, msiSeries },
    oscarConvention: {
      seriesCount: msiSeries.size,
      transactionsWithFraction: plain.filter(p => p.oscarParsed.numerator != null).length,
      transactionsWithDash: plain.filter(p => p.oscarParsed.store || p.oscarParsed.size || p.oscarParsed.brand || p.oscarParsed.quantity).length,
    },
  };
}

export function buildMonefyImportPlan(skeleton, initialBalances, { accountDecisions, existingAccounts, existingCategories, useOscarConvention }) {
  const accountsToAdd = [];
  const categoriesToAdd = [];
  const newAccountIds = new Map();
  const newCategoryIds = new Map();
  let colorIndex = existingAccounts.length + existingCategories.length;
  function nextColor() {
    return CATEGORY_PALETTE[colorIndex++ % CATEGORY_PALETTE.length];
  }

  function accountIdFor(name) {
    const decision = accountDecisions[name];
    if (!decision || decision.include === false) return null;
    if (newAccountIds.has(name)) return newAccountIds.get(name);
    const finalName = (decision.name || name).trim();
    const existing = existingAccounts.find(a => a.name.trim().toLowerCase() === finalName.toLowerCase());
    if (existing) {
      newAccountIds.set(name, existing.id);
      return existing.id;
    }
    const id = uid('acc');
    accountsToAdd.push({ id, name: finalName, type: decision.type || 'debito', color: nextColor(), initialBalance: initialBalances.get(name) || 0 });
    newAccountIds.set(name, id);
    return id;
  }

  function categoryIdFor(name, type) {
    const key = `${name.trim().toLowerCase()}|${type}`;
    if (newCategoryIds.has(key)) return newCategoryIds.get(key);
    const existing = existingCategories.find(c => c.type === type && c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) {
      newCategoryIds.set(key, existing.id);
      return existing.id;
    }
    const id = uid('cat');
    categoriesToAdd.push({ id, name: name.trim(), icon: guessCategoryIcon(name), color: nextColor(), type });
    newCategoryIds.set(key, id);
    return id;
  }

  // Crea/resuelve toda cuenta decidida por el usuario aunque no participe en
  // ninguna transacción (p. ej. una cuenta que solo tuvo un "Initial balance").
  for (const name of Object.keys(accountDecisions)) {
    accountIdFor(name);
  }

  const transactions = [];
  const installmentPlansToAdd = [];
  const baseCreatedAt = Date.now();
  let seq = 0;

  const planBySeriesKey = new Map();
  if (useOscarConvention && skeleton.msiSeries) {
    for (const [key, series] of skeleton.msiSeries) {
      const catId = categoryIdFor(series.categoryName, 'expense');
      const planId = uid('msi');
      installmentPlansToAdd.push({
        id: planId, description: series.description, store: series.store,
        totalAmount: series.totalAmount, installmentsCount: series.installmentsCount,
        categoryId: catId, startDate: series.startDate, createdAt: baseCreatedAt + (seq++),
      });
      planBySeriesKey.set(key, { id: planId, categoryId: catId });
    }
  }

  for (const row of skeleton.plain) {
    const accountId = accountIdFor(row.accountName);
    if (!accountId) continue;
    const plan = useOscarConvention && row._msiSeriesKey ? planBySeriesKey.get(row._msiSeriesKey) : null;
    const categoryId = plan ? plan.categoryId : categoryIdFor(row.categoryName, row.type);
    const useOscar = useOscarConvention && row.oscarParsed;
    const txn = {
      id: uid('txn'), type: row.type, accountId, categoryId,
      amount: Math.abs(row.amount), date: row.date,
      description: useOscar ? row.oscarParsed.description : row.description,
      store: useOscar ? (row.oscarParsed.store || '') : '',
      createdAt: baseCreatedAt + (seq++),
    };
    if (row.type === 'expense') {
      txn.installmentPlanId = plan ? plan.id : null;
      txn.size = useOscar ? (row.oscarParsed.size || null) : null;
      txn.brand = useOscar ? (row.oscarParsed.brand || null) : null;
      txn.quantity = useOscar ? (row.oscarParsed.quantity || null) : null;
    }
    transactions.push(txn);
  }

  for (const row of skeleton.transfers) {
    const fromId = accountIdFor(row.fromName);
    const toId = accountIdFor(row.toName);
    if (fromId && toId) {
      transactions.push({
        id: uid('txn'), type: 'transfer', fromAccountId: fromId, toAccountId: toId,
        amount: row.amount, date: row.date, description: row.description,
        taggedAsExpense: false, categoryId: null, installmentPlanId: null, store: '',
        createdAt: baseCreatedAt + (seq++),
      });
    } else if (fromId && !toId) {
      const categoryId = categoryIdFor(MONEFY_TRANSFER_CATEGORY, 'expense');
      transactions.push({ id: uid('txn'), type: 'expense', accountId: fromId, categoryId, amount: row.amount, date: row.date, description: row.description, store: '', createdAt: baseCreatedAt + (seq++) });
    } else if (!fromId && toId) {
      const categoryId = categoryIdFor(MONEFY_TRANSFER_CATEGORY, 'income');
      transactions.push({ id: uid('txn'), type: 'income', accountId: toId, categoryId, amount: row.amount, date: row.date, description: row.description, createdAt: baseCreatedAt + (seq++) });
    }
  }

  return { accountsToAdd, categoriesToAdd, installmentPlansToAdd, transactions };
}

/* ------------------------------------------------------------------ */
/* Escaneo de tickets (OCR con IA)                                     */
/* ------------------------------------------------------------------ */
/* Única parte de Hilo que llama a una API externa: la de Anthropic,
   directo desde el navegador con la key que el usuario pega en Ajustes
   (ver OCR_SETTINGS_STORAGE_KEY). No hay servidor del proyecto. La foto
   solo vive en memoria durante el escaneo. */

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

export function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      const header = comma >= 0 ? result.slice(0, comma) : '';
      const match = header.match(/data:([^;]+)/);
      resolve({ media_type: match ? match[1] : (blob.type || 'image/jpeg'), data: comma >= 0 ? result.slice(comma + 1) : result });
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

/* Reescala a JPEG con lado máximo `maxDim` para bajar peso y costo de la API
   y normalizar formatos raros (HEIC/webp). Devuelve el archivo original si ya
   es un JPEG chico o si el navegador no puede decodificar la imagen. */
export function downscaleImage(file, maxDim = 1600) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const longest = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, maxDim / longest);
      if (scale === 1 && file.type === 'image/jpeg' && file.size < 3 * 1024 * 1024) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export async function scanReceipt({ apiKey, model, image, expenseCategories }) {
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

  let res;
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
  } catch (e) {
    throw new Error('No hay conexión para leer el ticket.');
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('La clave de API no es válida.');
    if (res.status === 429) throw new Error('Se alcanzó el límite de uso de tu cuenta de API.');
    let detail = '';
    try { const body = await res.json(); if (body && body.error && body.error.message) detail = ` (${body.error.message})`; } catch (e) { /* sin cuerpo */ }
    throw new Error(`El servicio de OCR falló (código ${res.status})${detail}`);
  }

  let data;
  try { data = await res.json(); } catch (e) { throw new Error('No se pudo interpretar el ticket, intenta con otra foto.'); }
  const block = (data.content || []).find(b => b.type === 'tool_use');
  if (!block || !block.input) throw new Error('No se pudo interpretar el ticket, intenta con otra foto.');
  return block.input;
}

export function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function buildReceiptDraft(scan, { expenseCategories }) {
  const fallbackCat = expenseCategories[0] ? expenseCategories[0].id : '';
  const catIds = new Set(expenseCategories.map(c => c.id));
  const rows = (Array.isArray(scan.lineItems) ? scan.lineItems : []).map(it => ({
    id: uid('rrow'),
    description: (it.description || '').trim(),
    amount: Math.abs(Number(it.listPrice) || 0),
    quantity: it.quantity != null && Number(it.quantity) ? String(Number(it.quantity)) : '',
    categoryId: catIds.has(it.categoryId) ? it.categoryId : fallbackCat,
    accountId: null,
    included: true,
  }));
  const discounts = (Array.isArray(scan.discounts) ? scan.discounts : []).map(d => ({
    id: uid('rdsc'),
    label: (d.label || '').trim() || 'Descuento',
    amount: Math.abs(Number(d.amount) || 0),
    accountId: null,
    included: true,
  }));
  return {
    store: (scan.store || '').trim(),
    date: isValidIsoDate(scan.date) ? scan.date : todayIso(),
    ticketTotal: Math.abs(Number(scan.ticketTotal) || 0),
    rows,
    discounts,
  };
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                  */
/* ------------------------------------------------------------------ */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', Georgia, serif; }
      .font-mono-custom { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-variant-numeric: tabular-nums; }
      .hilo-scroll::-webkit-scrollbar { display: none; }
      .hilo-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.85); cursor: pointer; }
      input[type="number"]::-webkit-outer-spin-button,
      input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input[type="number"] { -moz-appearance: textfield; }
      @keyframes hiloSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes hiloFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .hilo-sheet { animation: hiloSlideUp 0.28s cubic-bezier(0.16,1,0.3,1); }
      .hilo-overlay { animation: hiloFadeIn 0.2s ease; }
      @media (prefers-reduced-motion: reduce) {
        .hilo-sheet, .hilo-overlay { animation: none !important; }
      }
    `}</style>
  );
}

function Toast({ message, desktop }) {
  const className = desktop
    ? 'fixed z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2'
    : 'absolute left-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2';
  const style = desktop
    ? { bottom: 24, right: 24, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` }
    : { top: 16, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` };
  return (
    <div className={className} style={style}>
      <Check size={15} style={{ color: COLORS.income }} />
      <span className="text-sm" style={{ color: COLORS.text }}>{message}</span>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <div className="flex items-center justify-around border-t px-1 py-2 shrink-0" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      {NAV_ITEMS.map(it => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl">
            <Icon size={20} style={{ color: isActive ? COLORS.accent : COLORS.textMuted }} />
            <span className="text-xs font-medium" style={{ color: isActive ? COLORS.accent : COLORS.textMuted }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop shell                                                       */
/* ------------------------------------------------------------------ */
/* Las cuatro pestañas ya son features: cada una monta su container y este
   elige la vista móvil o la de escritorio según el prop `desktop`. Lo que
   queda aquí del árbol de escritorio es el chrome — la barra lateral y el
   contenedor ancho —, más los modales sin migrar. */

function DesktopSidebar({ active, onChange, onOpenSettings, onAddTransaction, onScanReceipt }) {
  return (
    <div className="w-60 shrink-0 h-full flex flex-col border-r px-4 py-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      <div className="px-2 mb-8">
        <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
      </div>
      <button onClick={onAddTransaction} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-2" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
        <Plus size={16} /> Nueva transacción
      </button>
      <button onClick={onScanReceipt} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-6" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
        <ScanLine size={16} /> Escanear ticket
      </button>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(it => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onChange(it.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: isActive ? COLORS.accentSoft : 'transparent', color: isActive ? COLORS.accent : COLORS.textMuted }}>
              <Icon size={18} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <button onClick={onOpenSettings} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: COLORS.textMuted }}>
        <Settings size={18} /> Ajustes
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modals / sheets                                                      */
/* ------------------------------------------------------------------ */

function MonefyImportModal({ existingAccounts, existingCategories, onClose, onConfirm, desktop }) {
  const [step, setStep] = useState('upload');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [accountDecisions, setAccountDecisions] = useState({});
  const [useOscarConvention, setUseOscarConvention] = useState(true);
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseMonefyRows(String(reader.result || ''));
      if (!rows) {
        setError('Este archivo no parece un export CSV de Monefy (revisa el encabezado de columnas).');
        return;
      }
      if (!rows.length) {
        setError('El archivo no tiene movimientos.');
        return;
      }
      const built = buildMonefyImportPreview(rows);
      const decisions = {};
      for (const acc of built.accounts) {
        decisions[acc.name] = { include: true, type: acc.suggestedType, name: acc.name };
      }
      setPreview(built);
      setAccountDecisions(decisions);
      setStep('review');
    };
    reader.onerror = () => setError('No se pudo leer el archivo.');
    reader.readAsText(file);
  }

  function updateDecision(name, patch) {
    setAccountDecisions(prev => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }

  function runImport() {
    setStep('importing');
    setTimeout(() => {
      const plan = buildMonefyImportPlan(preview.skeleton, preview.initialBalances, {
        accountDecisions, existingAccounts, existingCategories, useOscarConvention,
      });
      setResult(plan);
      setStep('done');
    }, 0);
  }

  function finish() {
    if (result) onConfirm(result);
    onClose();
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Importar desde Monefy</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {step === 'upload' && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Sube el CSV que exportas desde Monefy (no el backup cifrado). Todo se procesa en tu navegador, nada se sube a ningún servidor.
          </p>
          <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border cursor-pointer" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: COLORS.surfaceAlt }}>
            <Layers size={20} style={{ color: COLORS.textMuted }} />
            <span className="text-sm font-medium" style={{ color: COLORS.text }}>{fileName || 'Seleccionar archivo .csv'}</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
          {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
        </div>
      )}

      {step === 'review' && preview && (
        <div className="px-5 mt-3 pb-6">
          <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <p className="text-sm font-medium" style={{ color: COLORS.text }}>{preview.transactionCount} movimientos detectados</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
              {formatDateLabel(preview.dateRange.min)} — {formatDateLabel(preview.dateRange.max)} · {preview.transferCount} transferencias
            </p>
            {useOscarConvention && preview.oscarConvention.seriesCount > 0 && (
              <p className="text-xs mt-0.5" style={{ color: COLORS.accent }}>{preview.oscarConvention.seriesCount} planes de MSI detectados por la convención de Oscar</p>
            )}
          </div>

          <button onClick={() => setUseOscarConvention(v => !v)} className="w-full flex items-center justify-between p-3 rounded-xl mb-4" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex-1 text-left pr-3">
              <span className="text-sm font-medium block" style={{ color: COLORS.text }}>Usar la convención de Oscar</span>
              <span className="text-xs block mt-0.5" style={{ color: COLORS.textFaint }}>Reconoce fracciones "(N/D)" como pagos de MSI y separa "item - lugar - tamaño - marca - cantidad". Es específico de esta forma de anotar en Monefy, no una función genérica.</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors shrink-0" style={{ backgroundColor: useOscarConvention ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: useOscarConvention ? 18 : 2 }} />
            </div>
          </button>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuentas detectadas</p>
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Si excluyes una cuenta, no se importa ninguno de sus movimientos; las transferencias donde participaba se convierten en gasto/ingreso en la otra cuenta.</p>

          <div className="space-y-2 mb-2">
            {preview.accounts.map(acc => {
              const decision = accountDecisions[acc.name] || { include: true, type: acc.suggestedType, name: acc.name };
              const existingMatch = existingAccounts.find(a => a.name.trim().toLowerCase() === (decision.name || acc.name).trim().toLowerCase());
              return (
                <div key={acc.name} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, opacity: decision.include ? 1 : 0.5 }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateDecision(acc.name, { include: !decision.include })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: decision.include ? COLORS.accent : 'transparent', border: `1px solid ${decision.include ? COLORS.accent : COLORS.borderStrong}` }}>
                      {decision.include && <Check size={12} style={{ color: COLORS.bg }} />}
                    </button>
                    <input value={decision.name} onChange={e => updateDecision(acc.name, { name: e.target.value })} className="flex-1 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                  </div>
                  {acc.isGhost && (
                    <p className="text-xs mt-1.5 ml-7" style={{ color: COLORS.textFaint }}>Solo aparece en transferencias antiguas — probablemente renombrada o cerrada.</p>
                  )}
                  {existingMatch ? (
                    <p className="text-xs mt-1.5 ml-7" style={{ color: COLORS.income }}>Ya existe en Hilo, se fusiona.</p>
                  ) : decision.include && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2 ml-7">
                      {ACCOUNT_TYPES.map(t => {
                        const Icon = t.icon;
                        const isSel = decision.type === t.id;
                        return (
                          <button key={t.id} onClick={() => updateDecision(acc.name, { type: t.id })} className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border" style={{ borderColor: isSel ? COLORS.accent : COLORS.border, backgroundColor: isSel ? COLORS.accentSoft : 'transparent' }}>
                            <Icon size={13} style={{ color: isSel ? COLORS.accent : COLORS.textMuted }} />
                            <span className="text-[10px] text-center leading-tight" style={{ color: COLORS.text }}>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={runImport} className="w-full mt-4 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Importar {preview.transactionCount} movimientos
          </button>
        </div>
      )}

      {step === 'importing' && (
        <div className="px-5 py-10 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Importando…</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="px-5 mt-3 pb-6">
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: COLORS.incomeSoft }}>
            <p className="text-sm font-medium" style={{ color: COLORS.income }}>¡Listo! Se importaron {result.transactions.length} movimientos.</p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{result.accountsToAdd.length} cuentas nuevas · {result.categoriesToAdd.length} categorías nuevas{result.installmentPlansToAdd.length > 0 ? ` · ${result.installmentPlansToAdd.length} planes de MSI` : ''}</p>
          </div>
          <button onClick={finish} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Listo
          </button>
        </div>
      )}
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Escanear ticket (OCR con IA)                                        */
/* ------------------------------------------------------------------ */

function ReceiptScanModal({ accounts, categories, apiKey, model, onClose, onConfirm, onOpenSettings, desktop }) {
  const expenseCats = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  const [step, setStep] = useState('capture'); // capture | processing | review | saving
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);

  const [store, setStore] = useState('');
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [primaryAccountId, setPrimaryAccountId] = useState(accounts[0] ? accounts[0].id : '');
  const [originAccountId, setOriginAccountId] = useState(accounts[1] ? accounts[1].id : (accounts[0] ? accounts[0].id : ''));
  const [accountModes, setAccountModes] = useState({}); // { [accountId]: bool } — solo este ticket

  function accountName(id) {
    const a = accounts.find(x => x.id === id);
    return a ? a.name : '—';
  }

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    setStep('processing');
    try {
      const small = await downscaleImage(file);
      const image = await fileToBase64(small);
      const scan = await scanReceipt({ apiKey, model, image, expenseCategories: expenseCats });
      const d = buildReceiptDraft(scan, { expenseCategories: expenseCats });
      setDraft(d);
      setStore(d.store);
      setDate(d.date);
      setRows(d.rows);
      setDiscounts(d.discounts);
      setStep('review');
    } catch (err) {
      setError(err && err.message ? err.message : 'No se pudo leer el ticket.');
      setStep('capture');
    }
  }

  const rowAccountId = (r) => r.accountId || primaryAccountId;
  const includedRows = rows.filter(r => r.included);
  const includedDiscounts = discounts.filter(d => d.included);
  const usedAccountIds = Array.from(new Set(includedRows.map(rowAccountId)));
  const anyTransfer = usedAccountIds.some(id => accountModes[id]);

  const sumRows = includedRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const sumDiscounts = includedDiscounts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const net = sumRows - sumDiscounts;
  const ticketTotal = draft ? draft.ticketTotal : 0;
  const mismatch = ticketTotal > 0 && Math.abs(net - ticketTotal) > 0.5;
  const totalCount = includedRows.length + includedDiscounts.length;
  const canSave = totalCount > 0 && !!primaryAccountId && (!anyTransfer || !!originAccountId);

  function patchRow(id, patch) { setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)); }
  function patchDiscount(id, patch) { setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d)); }
  function addDiscount() { setDiscounts(prev => [...prev, { id: uid('rdsc'), label: '', amount: '', accountId: null, included: true }]); }

  function handleConfirm() {
    setStep('saving');
    onConfirm({
      date,
      store: store.trim(),
      originAccountId,
      rows: includedRows.map(r => ({
        description: r.description.trim(),
        amount: parseFloat(r.amount) || 0,
        categoryId: r.categoryId,
        accountId: rowAccountId(r),
        quantity: (r.quantity || '').trim(),
        viaTransfer: !!accountModes[rowAccountId(r)],
      })),
      discounts: includedDiscounts.map(d => ({
        label: d.label.trim(),
        amount: parseFloat(d.amount) || 0,
        accountId: d.accountId || primaryAccountId,
      })),
    });
    onClose();
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Escanear ticket</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {step === 'capture' && !apiKey && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-sm leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Para escanear tickets necesitas configurar tu API key de Anthropic en Ajustes. La foto se envía directo a la API de Anthropic con tu key; no pasa por ningún servidor de Hilo.
          </p>
          <button onClick={onOpenSettings} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
            Ir a Ajustes
          </button>
        </div>
      )}

      {step === 'capture' && apiKey && (
        <div className="px-5 mt-3 pb-6">
          <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
            Toma o sube una foto del ticket. Se envía a la API de Anthropic con tu key; la imagen no se guarda.
          </p>
          <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border cursor-pointer" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: COLORS.surfaceAlt }}>
            <ScanLine size={20} style={{ color: COLORS.textMuted }} />
            <span className="text-sm font-medium" style={{ color: COLORS.text }}>Seleccionar o tomar foto</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>
          {error && <p className="text-xs mt-3" style={{ color: COLORS.expense }}>{error}</p>}
        </div>
      )}

      {step === 'processing' && (
        <div className="px-5 py-12 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Leyendo el ticket…</p>
        </div>
      )}

      {step === 'saving' && (
        <div className="px-5 py-12 flex flex-col items-center gap-2">
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Guardando…</p>
        </div>
      )}

      {step === 'review' && draft && (
        <div className="px-5 mt-3 pb-6">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tienda</p>
              <input type="text" value={store} onChange={e => setStore(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
            </div>
          </div>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuenta principal</p>
          <div className="mb-4"><AccountChips accounts={accounts} value={primaryAccountId} onSelect={setPrimaryAccountId} /></div>

          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Artículos ({includedRows.length})</p>
          <div className="space-y-2 mb-4">
            {rows.map(r => {
              const isTransfer = !!accountModes[rowAccountId(r)];
              return (
                <div key={r.id} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, opacity: r.included ? 1 : 0.5 }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => patchRow(r.id, { included: !r.included })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: r.included ? COLORS.accent : 'transparent', border: `1px solid ${r.included ? COLORS.accent : COLORS.borderStrong}` }}>
                      {r.included && <Check size={12} style={{ color: COLORS.bg }} />}
                    </button>
                    <input value={r.description} onChange={e => patchRow(r.id, { description: e.target.value })} placeholder="Artículo" className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs" style={{ color: COLORS.textFaint }}>$</span>
                      <input value={r.amount} onChange={e => patchRow(r.id, { amount: e.target.value })} inputMode="decimal" className="w-20 px-2 py-1 rounded-lg text-sm outline-none text-right font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                    </div>
                  </div>
                  {r.included && (
                    <div className="mt-2 ml-7 flex items-center gap-2 flex-wrap">
                      <select value={r.categoryId} onChange={e => patchRow(r.id, { categoryId: e.target.value })} className="px-2 py-1 rounded-lg text-xs outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                        {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select value={r.accountId || ''} onChange={e => patchRow(r.id, { accountId: e.target.value || null })} className="px-2 py-1 rounded-lg text-xs outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
                        <option value="">{`Principal · ${accountName(primaryAccountId)}`}</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: isTransfer ? COLORS.accentSoft : COLORS.expenseSoft, color: isTransfer ? COLORS.accent : COLORS.expense }}>
                        {isTransfer ? 'Transferencia · gasto' : 'Gasto'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {usedAccountIds.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuentas de este ticket</p>
              <div className="space-y-2 mb-2">
                {usedAccountIds.map(id => {
                  const on = !!accountModes[id];
                  return (
                    <button key={id} onClick={() => setAccountModes(prev => ({ ...prev, [id]: !prev[id] }))} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
                      <div className="flex-1 text-left pr-3">
                        <span className="text-sm font-medium block" style={{ color: COLORS.text }}>{accountName(id)}</span>
                        <span className="text-xs block mt-0.5" style={{ color: COLORS.textFaint }}>{on ? 'Registrar como transferencia marcada como gasto' : 'Registrar como gasto simple'}</span>
                      </div>
                      <div className="w-10 h-6 rounded-full relative transition-colors shrink-0" style={{ backgroundColor: on ? COLORS.accent : COLORS.border }}>
                        <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: on ? 18 : 2 }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mb-4 px-1" style={{ color: COLORS.textFaint }}>El modo "transferencia" es solo para este ticket; no cambia la cuenta.</p>
            </>
          )}

          {anyTransfer && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cuenta de origen</p>
              <AccountChips accounts={accounts} value={originAccountId} onSelect={setOriginAccountId} />
              <p className="text-xs mt-1 px-1" style={{ color: COLORS.textFaint }}>De aquí sale el dinero de las transferencias marcadas como gasto.</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Descuentos</p>
            <button onClick={addDiscount} className="text-xs font-medium flex items-center gap-1" style={{ color: COLORS.accent }}><Plus size={12} /> Agregar</button>
          </div>
          {discounts.length === 0 && <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Sin descuentos detectados.</p>}
          <div className="space-y-2 mb-1">
            {discounts.map(d => (
              <div key={d.id} className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, opacity: d.included ? 1 : 0.5 }}>
                <button onClick={() => patchDiscount(d.id, { included: !d.included })} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: d.included ? COLORS.accent : 'transparent', border: `1px solid ${d.included ? COLORS.accent : COLORS.borderStrong}` }}>
                  {d.included && <Check size={12} style={{ color: COLORS.bg }} />}
                </button>
                <input value={d.label} onChange={e => patchDiscount(d.id, { label: e.target.value })} placeholder="Descuento" className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
                <span className="text-xs" style={{ color: COLORS.textFaint }}>$</span>
                <input value={d.amount} onChange={e => patchDiscount(d.id, { amount: e.target.value })} inputMode="decimal" className="w-20 px-2 py-1 rounded-lg text-sm outline-none text-right font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
              </div>
            ))}
          </div>
          <p className="text-xs mb-4 px-1" style={{ color: COLORS.textFaint }}>Se registran como ingreso en la categoría "Descuentos".</p>

          <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex justify-between text-xs" style={{ color: COLORS.textMuted }}>
              <span>Suma de artículos</span><span className="font-mono-custom">{formatMoney(sumRows)}</span>
            </div>
            <div className="flex justify-between text-xs mt-1" style={{ color: COLORS.textMuted }}>
              <span>− Descuentos</span><span className="font-mono-custom">{formatMoney(sumDiscounts)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 font-medium" style={{ color: COLORS.text }}>
              <span>= Neto</span><span className="font-mono-custom">{formatMoney(net)}</span>
            </div>
            {ticketTotal > 0 && (
              <div className="flex justify-between text-xs mt-1" style={{ color: COLORS.textFaint }}>
                <span>Total del ticket</span><span className="font-mono-custom">{formatMoney(ticketTotal)}</span>
              </div>
            )}
          </div>
          {mismatch && <p className="text-xs mb-3 px-1" style={{ color: COLORS.accent }}>La suma no cuadra con el total del ticket; revisa los montos.</p>}

          <div className="flex gap-2 mt-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
              Descartar
            </button>
            <button onClick={handleConfirm} disabled={!canSave} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ backgroundColor: canSave ? COLORS.accent : COLORS.border, color: canSave ? COLORS.bg : COLORS.textFaint }}>
              Agregar {totalCount} {totalCount === 1 ? 'movimiento' : 'movimientos'}
            </button>
          </div>
        </div>
      )}
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Respaldo de datos (exportar / restaurar reemplazando todo)          */
/* ------------------------------------------------------------------ */

function SettingsModal({ onClose, onResetTransactions, onOpenImport, onOpenSync, onOpenBackup, ocrSettings, onSaveOcrSettings, desktop }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [keyDraft, setKeyDraft] = useState((ocrSettings && ocrSettings.apiKey) || '');
  const [modelDraft, setModelDraft] = useState((ocrSettings && ocrSettings.model) || '');
  const savedKey = (ocrSettings && ocrSettings.apiKey) || '';
  const maskedKey = savedKey ? `•••• ${savedKey.slice(-4)}` : null;
  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Ajustes</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <div className="px-5 mt-3 pb-6">
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium" style={{ color: COLORS.text }}>Moneda</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>Pesos mexicanos (MXN)</p>
        </div>
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Sobre la trazabilidad</p>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>Cuando marcas una transferencia como gasto, el monto cuenta en tus reportes por categoría, pero no resta de tu saldo total: el dinero sigue siendo tuyo hasta que de verdad pagas la tarjeta de crédito.</p>
        </div>
        <button onClick={onOpenSync} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <RefreshCw size={15} /> Sincronizar dispositivos
        </button>
        <button onClick={onOpenBackup} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <DatabaseBackup size={15} /> Respaldo de datos
        </button>
        <button onClick={onOpenImport} className="w-full py-3 rounded-xl text-sm font-semibold mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Importar desde Monefy</button>

        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Escaneo de tickets (IA)</p>
          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
            La key se guarda solo en este dispositivo y se envía directo a Anthropic junto con la foto del ticket. No se incluye en la sincronización ni en los respaldos. Usa una key dedicada para Hilo con un límite de gasto mensual: {' '}
            <span style={{ color: COLORS.textFaint }}>console.anthropic.com/settings/keys</span>
          </p>
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>API key {maskedKey ? `· guardada (${maskedKey})` : ''}</p>
          <input
            type="password"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>Modelo</p>
          <input
            type="text"
            value={modelDraft}
            onChange={e => setModelDraft(e.target.value)}
            placeholder={RECEIPT_MODEL_DEFAULT}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Déjalo vacío para usar el modelo por defecto (Haiku, más barato). Puedes poner otro id si quieres más precisión.</p>
          <div className="flex gap-2">
            <button onClick={() => onSaveOcrSettings({ apiKey: keyDraft.trim(), model: modelDraft.trim() })} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>Guardar</button>
            {savedKey && (
              <button onClick={() => { setKeyDraft(''); setModelDraft(''); onSaveOcrSettings({ apiKey: '', model: '' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Quitar</button>
            )}
          </div>
        </div>

        {!confirmingReset ? (
          <button onClick={() => setConfirmingReset(true)} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>Borrar todos los movimientos</button>
        ) : (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Seguro? Se borrarán todos tus movimientos (tus cuentas se quedan).</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingReset(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => { onResetTransactions(); setConfirmingReset(false); onClose(); }} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Sí, borrar</button>
            </div>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop shell                                                       */
/* ------------------------------------------------------------------ */
/* Layout raíz de escritorio: sidebar fijo + área principal ancha, montado por
   App cuando useIsDesktop() es true, en vez del árbol móvil (max-w-md +
   BottomNav). Recibe el mismo estado/handlers que App ya pasa al árbol móvil
   — ver el bloque `if (isDesktop)` en App más abajo. */

function DesktopShell(props) {
  const {
    activeTab, setActiveTab,
    accounts, categories,
    onOpenAddSheet, onOpenSettings,
    settingsOpen, onCloseSettings, onResetTransactions,
    importModalOpen, onOpenImport, onCloseImportModal, onConfirmImport,
    onOpenSync, onOpenBackup,
    receiptModalOpen, onOpenReceipt, onCloseReceiptModal, onConfirmReceipt, ocrSettings, onSaveOcrSettings,
    toast,
  } = props;

  const tabTitles = { home: 'Inicio', history: 'Historial', msi: 'Compras a meses', accounts: 'Cuentas' };

  return (
    <div className="w-full h-screen flex" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyles />
      <DesktopSidebar active={activeTab} onChange={setActiveTab} onOpenSettings={onOpenSettings} onAddTransaction={() => onOpenAddSheet('expense')} onScanReceipt={onOpenReceipt} />

      <div className="flex-1 h-full overflow-y-auto hilo-scroll relative">
        <div className="max-w-6xl mx-auto px-10 py-8">
          <h2 className="text-2xl font-semibold font-display mb-6" style={{ color: COLORS.text }}>{tabTitles[activeTab]}</h2>

          {activeTab === 'home' && (
            <HomeContainer desktop />
          )}
          {activeTab === 'history' && (
            <HistoryContainer desktop />
          )}
          {activeTab === 'msi' && <MsiContainer desktop />}
          {activeTab === 'accounts' && <AccountsContainer desktop />}
        </div>

        {toast && <Toast message={toast} desktop />}
      </div>

      <AddTransactionContainer desktop />

      <AccountFormContainer desktop />

      <MsiPlanFormContainer desktop />

      {settingsOpen && (
        <SettingsModal onClose={onCloseSettings} onResetTransactions={onResetTransactions} onOpenImport={onOpenImport} onOpenSync={onOpenSync} onOpenBackup={onOpenBackup} ocrSettings={ocrSettings} onSaveOcrSettings={onSaveOcrSettings} desktop />
      )}

      {importModalOpen && (
        <MonefyImportModal
          existingAccounts={accounts}
          existingCategories={categories}
          onClose={onCloseImportModal}
          onConfirm={onConfirmImport}
          desktop
        />
      )}

      {receiptModalOpen && (
        <ReceiptScanModal
          accounts={accounts}
          categories={categories}
          apiKey={ocrSettings.apiKey}
          model={ocrSettings.model}
          onClose={onCloseReceiptModal}
          onConfirm={onConfirmReceipt}
          onOpenSettings={() => { onCloseReceiptModal(); onOpenSettings(); }}
          desktop
        />
      )}

      <SyncContainer desktop />

      <BackupContainer desktop />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                  */
/* ------------------------------------------------------------------ */

/* El default export ya solo monta el store; el árbol vive en `AppBody`.
   El store se construye por montaje (ver src/app/store-context.tsx), así que
   cada render(<App/>) arranca limpio — misma semántica que cuando el estado
   vivía en los 29 useState de este componente. */
export default function App() {
  return (
    <HiloStoreProvider>
      <AppBody />
    </HiloStoreProvider>
  );
}

function AppBody() {
  /* Sin selector: se re-renderiza ante cualquier cambio del store, que es
     exactamente lo que hacía este componente cuando era dueño del estado.
     Los selectores granulares llegan con los containers de cada feature. */
  const {
    loaded, accounts, categories,
    setAccounts, setCategories, setTransactions, setInstallmentPlans,

    /* Navegación entre pestañas. Los filtros del historial y el cursor de mes
       siguen en el store, pero ya solo los lee el container de su feature. */
    activeTab, setActiveTab,

    /* Acciones de los slices de las features ya migradas. Las hojas y vistas se
       montan por container, así que sus campos ya no se leen aquí. */
    openAddSheet, resetTransactions,

    settingsOpen,
    importModalOpen, receiptModalOpen,
    setSettingsOpen,
    setImportModalOpen, setSyncModalOpen, setBackupModalOpen, setReceiptModalOpen,

    ocrSettings, setOcrSettings, syncState, setSyncState, toast, setToast,
  } = useHiloStore();

  /* La hidratación y el guardado automático los lleva el Provider
     (src/app/persistence.ts). Aquí solo queda el auto-cierre del toast, que es
     puro asunto de UI. */
  useToastAutoDismiss();

  const isDesktop = useIsDesktop();

  /* Ya no queda un solo dato derivado aquí: los diez `useMemo` originales se
     fueron con sus features. Lo de abajo es lo que todavía no se migra. */

  function openImportModal() {
    setSettingsOpen(false);
    setImportModalOpen(true);
  }

  function openSyncModal() {
    setSettingsOpen(false);
    setSyncModalOpen(true);
  }

  function openBackupModal() {
    setSettingsOpen(false);
    setBackupModalOpen(true);
  }

  function handleSaveOcrSettings(next) {
    const clean = { apiKey: (next.apiKey || '').trim(), model: (next.model || '').trim() };
    setOcrSettings(clean);
    saveOcrSettings(clean).catch(() => setToast('No se pudo guardar la config de escaneo'));
    setToast(clean.apiKey ? 'Config de escaneo guardada' : 'API key eliminada');
  }

  function handleAddReceiptTransactions(payload) {
    const now = Date.now();
    const built = [];

    payload.rows.forEach(r => {
      const amount = parseFloat(r.amount) || 0;
      if (amount <= 0) return;
      const base = { date: payload.date || todayIso(), description: (r.description || '').trim(), amount };
      if (r.viaTransfer) {
        built.push({
          ...base, type: 'transfer',
          fromAccountId: payload.originAccountId, toAccountId: r.accountId,
          taggedAsExpense: true, categoryId: r.categoryId, installmentPlanId: null,
          store: payload.store || null, size: null, brand: null,
          quantity: (r.quantity || '').trim() || null,
        });
      } else {
        built.push({
          ...base, type: 'expense',
          accountId: r.accountId, categoryId: r.categoryId, installmentPlanId: null,
          store: payload.store || null, size: null, brand: null,
          quantity: (r.quantity || '').trim() || null,
        });
      }
    });

    const includedDiscounts = payload.discounts.filter(d => (parseFloat(d.amount) || 0) > 0);
    let categoriesNext = categories;
    if (includedDiscounts.length) {
      let discountCat = categories.find(c => c.type === 'income' && c.name.trim().toLowerCase() === 'descuentos');
      if (!discountCat) {
        discountCat = { id: uid('cat'), name: 'Descuentos', icon: 'Ticket', color: '#6FA8A0', type: 'income', createdAt: now, updatedAt: now };
        categoriesNext = [...categories, discountCat];
        setCategories(categoriesNext);
      }
      includedDiscounts.forEach(d => {
        built.push({
          date: payload.date || todayIso(),
          description: (d.label || '').trim() || 'Descuento',
          amount: parseFloat(d.amount) || 0,
          type: 'income', accountId: d.accountId, categoryId: discountCat.id,
        });
      });
    }

    if (!built.length) { setToast('No hay movimientos por agregar'); return; }
    setTransactions(prev => [...prev, ...built.map(t => ({ ...t, id: uid('txn'), createdAt: now, updatedAt: now }))]);
    setToast(`${built.length} ${built.length === 1 ? 'movimiento agregado' : 'movimientos agregados'} desde el ticket`);
  }

  function handleImportMonefy(plan) {
    const now = Date.now();
    const stamp = (r) => ({ ...r, updatedAt: now });
    if (plan.accountsToAdd.length) setAccounts(prev => [...prev, ...plan.accountsToAdd.map(stamp)]);
    if (plan.categoriesToAdd.length) setCategories(prev => [...prev, ...plan.categoriesToAdd.map(stamp)]);
    if (plan.installmentPlansToAdd && plan.installmentPlansToAdd.length) setInstallmentPlans(prev => [...prev, ...plan.installmentPlansToAdd.map(stamp)]);
    setTransactions(prev => [...prev, ...plan.transactions.map(stamp)]);
    setToast(`Se importaron ${plan.transactions.length} movimientos de Monefy`);
  }

  if (!loaded) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Cargando…</p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <DesktopShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accounts={accounts}
        categories={categories}
        onOpenAddSheet={openAddSheet}
        onOpenSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onResetTransactions={resetTransactions}
        importModalOpen={importModalOpen}
        onOpenImport={openImportModal}
        onCloseImportModal={() => setImportModalOpen(false)}
        onConfirmImport={handleImportMonefy}
        onOpenSync={openSyncModal}
        onOpenBackup={openBackupModal}
        receiptModalOpen={receiptModalOpen}
        onOpenReceipt={() => setReceiptModalOpen(true)}
        onCloseReceiptModal={() => setReceiptModalOpen(false)}
        onConfirmReceipt={handleAddReceiptTransactions}
        ocrSettings={ocrSettings}
        onSaveOcrSettings={handleSaveOcrSettings}
        toast={toast}
      />
    );
  }

  return (
    <div className="w-full h-screen flex justify-center" style={{ backgroundColor: COLORS.bg }}>
      <div className="relative w-full max-w-md h-full flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
        <GlobalStyles />

        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <Settings size={16} style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hilo-scroll px-5 pb-24">
          {activeTab === 'home' && (
            <HomeContainer />
          )}
          {activeTab === 'history' && (
            <HistoryContainer />
          )}
          {activeTab === 'msi' && <MsiContainer />}
          {activeTab === 'accounts' && <AccountsContainer />}
        </div>

        <BottomNav active={activeTab} onChange={setActiveTab} />

        <button
          onClick={() => setReceiptModalOpen(true)}
          aria-label="Escanear ticket"
          className="absolute right-6 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderStrong}`, bottom: 150 }}
        >
          <ScanLine size={18} color={COLORS.text} />
        </button>

        <button
          onClick={() => openAddSheet('expense')}
          aria-label="Agregar movimiento"
          className="absolute right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: COLORS.accent, bottom: 82 }}
        >
          <Plus size={24} color={COLORS.bg} />
        </button>

        <AddTransactionContainer />

        <AccountFormContainer />

        <MsiPlanFormContainer />

        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} onResetTransactions={resetTransactions} onOpenImport={openImportModal} onOpenSync={openSyncModal} onOpenBackup={openBackupModal} ocrSettings={ocrSettings} onSaveOcrSettings={handleSaveOcrSettings} />
        )}

        {importModalOpen && (
          <MonefyImportModal
            existingAccounts={accounts}
            existingCategories={categories}
            onClose={() => setImportModalOpen(false)}
            onConfirm={handleImportMonefy}
          />
        )}

        {receiptModalOpen && (
          <ReceiptScanModal
            accounts={accounts}
            categories={categories}
            apiKey={ocrSettings.apiKey}
            model={ocrSettings.model}
            onClose={() => setReceiptModalOpen(false)}
            onConfirm={handleAddReceiptTransactions}
            onOpenSettings={() => { setReceiptModalOpen(false); setSettingsOpen(true); }}
          />
        )}

        <SyncContainer />

        <BackupContainer />

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
