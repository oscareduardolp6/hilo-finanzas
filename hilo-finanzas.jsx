import { useState, useEffect, useMemo } from 'react';
import {
  Plus, X, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Wallet, Landmark, CreditCard,
  PiggyBank, TrendingUp, Coins, UtensilsCrossed, Car, Home, Zap, HeartPulse, Sparkles,
  Film, Shirt, GraduationCap, PawPrint, Gift, ShoppingBag, MoreHorizontal, Briefcase,
  RotateCcw, ChevronLeft, ChevronRight, Settings, Receipt, LayoutGrid, Link2, Trash2,
  Check, Banknote, Music, Plane, Coffee, Dumbbell, Book, Wrench, Smartphone, Baby,
  Star, Umbrella, Fuel, Ticket, Layers,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */

const COLORS = {
  bg: '#0F1A17',
  surface: '#16221D',
  surfaceAlt: '#1D2C25',
  elevated: '#24352C',
  border: 'rgba(243,241,234,0.09)',
  borderStrong: 'rgba(243,241,234,0.16)',
  text: '#F3F1EA',
  textMuted: '#96A69D',
  textFaint: '#69796F',
  accent: '#C9A24B',
  accentSoft: 'rgba(201,162,75,0.16)',
  income: '#5FD9A5',
  incomeSoft: 'rgba(95,217,165,0.14)',
  expense: '#FF7A6E',
  expenseSoft: 'rgba(255,122,110,0.14)',
};

const CATEGORY_PALETTE = ['#E0793F', '#4A7FC4', '#8D6E63', '#C9A24B', '#C4574F', '#C97FB0', '#7B6FB0', '#3F9C8B', '#5C8A5C', '#4FA8A0', '#8D5FB0', '#8A9490'];

const ACCOUNT_TYPES = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'debito', label: 'Débito / Cuenta', icon: Landmark },
  { id: 'credito', label: 'Tarjeta de crédito', icon: CreditCard },
  { id: 'ahorro', label: 'Ahorro', icon: PiggyBank },
  { id: 'inversion', label: 'Inversión', icon: TrendingUp },
  { id: 'otro', label: 'Otro', icon: Coins },
];

const ICONS = {
  UtensilsCrossed, Car, Home, Zap, HeartPulse, Sparkles, Film, Shirt, GraduationCap,
  PawPrint, Gift, ShoppingBag, MoreHorizontal, Wallet, Briefcase, TrendingUp, RotateCcw,
  Music, Plane, Coffee, Dumbbell, Book, Wrench, Smartphone, Baby, Star, Umbrella, Fuel, Ticket,
};

const ICON_CHOICES = Object.keys(ICONS);

function IconFor(name) {
  return ICONS[name] || MoreHorizontal;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F' },
  { id: 'transporte', name: 'Transporte', icon: 'Car', color: '#4A7FC4' },
  { id: 'vivienda', name: 'Vivienda', icon: 'Home', color: '#8D6E63' },
  { id: 'servicios', name: 'Servicios', icon: 'Zap', color: '#C9A24B' },
  { id: 'salud', name: 'Salud', icon: 'HeartPulse', color: '#C4574F' },
  { id: 'belleza', name: 'Belleza', icon: 'Sparkles', color: '#C97FB0' },
  { id: 'entretenimiento', name: 'Entretenimiento', icon: 'Film', color: '#7B6FB0' },
  { id: 'ropa', name: 'Ropa', icon: 'Shirt', color: '#3F9C8B' },
  { id: 'educacion', name: 'Educación', icon: 'GraduationCap', color: '#5C8A5C' },
  { id: 'mascotas', name: 'Mascotas', icon: 'PawPrint', color: '#A3A15C' },
  { id: 'regalos', name: 'Regalos', icon: 'Gift', color: '#C15C7A' },
  { id: 'compras', name: 'Compras', icon: 'ShoppingBag', color: '#4FA8A0' },
  { id: 'otros_gasto', name: 'Otros', icon: 'MoreHorizontal', color: '#8A9490' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { id: 'salario', name: 'Salario', icon: 'Wallet', color: '#4FA57B' },
  { id: 'freelance', name: 'Freelance', icon: 'Briefcase', color: '#3F9C6E' },
  { id: 'inversion_ingreso', name: 'Inversión', icon: 'TrendingUp', color: '#2E8B6F' },
  { id: 'regalo_ingreso', name: 'Regalo', icon: 'Gift', color: '#C9A24B' },
  { id: 'reembolso', name: 'Reembolso', icon: 'RotateCcw', color: '#4A7FC4' },
  { id: 'otros_ingreso', name: 'Otros', icon: 'MoreHorizontal', color: '#8A9490' },
];

const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, type: 'expense' })),
  ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, type: 'income' })),
];

const DEFAULT_ACCOUNTS = [
  { id: 'acc_efectivo', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 0 },
  { id: 'acc_nu', name: 'NU', type: 'debito', color: '#8D5FB0', initialBalance: 8000 },
  { id: 'acc_mp', name: 'Mercado Pago', type: 'debito', color: '#3F9C8B', initialBalance: 0 },
];

const STORAGE_KEY = 'hilo_finanzas_data_v1';

const DB_NAME = 'hilo_finanzas';
const DB_VERSION = 1;
const STORE_NAME = 'state';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadState() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STORAGE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveState(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, STORAGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: LayoutGrid },
  { id: 'history', label: 'Historial', icon: Receipt },
  { id: 'msi', label: 'MSI', icon: Layers },
  { id: 'accounts', label: 'Cuentas', icon: Landmark },
];

const DESKTOP_BREAKPOINT = 1024; // Tailwind `lg` — layout de escritorio (ver DesktopShell)

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

function uid(prefix) {
  return `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d) {
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateLabel(iso) {
  const parts = iso.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Hoy';
  if (d.getTime() === yesterday.getTime()) return 'Ayer';
  const opts = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  const label = d.toLocaleDateString('es-MX', opts);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatMoney(n) {
  const num = Number(n) || 0;
  const sign = num < 0 ? '-' : '';
  return sign + '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeAccountBalance(account, transactions) {
  let bal = Number(account.initialBalance) || 0;
  for (const t of transactions) {
    if (t.type === 'income' && t.accountId === account.id) bal += t.amount;
    else if (t.type === 'expense' && t.accountId === account.id) bal -= t.amount;
    else if (t.type === 'transfer') {
      if (t.fromAccountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

function groupByDate(list) {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const groups = [];
  let currentLabel = null;
  let currentList = null;
  for (const t of sorted) {
    const label = formatDateLabel(t.date);
    if (label !== currentLabel) {
      currentLabel = label;
      currentList = [];
      groups.push([label, currentList]);
    }
    currentList.push(t);
  }
  return groups;
}

function initialFormState(type, accounts, categories) {
  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const base = { date: todayIso(), description: '', amount: '', store: '' };
  if (type === 'expense') {
    return { ...base, accountId: accounts[0] ? accounts[0].id : '', categoryId: expenseCats[0] ? expenseCats[0].id : '', installmentPlanId: null, size: '', brand: '', quantity: '' };
  }
  if (type === 'income') {
    return { ...base, accountId: accounts[0] ? accounts[0].id : '', categoryId: incomeCats[0] ? incomeCats[0].id : '' };
  }
  const secondAccount = accounts[1] ? accounts[1].id : (accounts[0] ? accounts[0].id : '');
  return { ...base, fromAccountId: accounts[0] ? accounts[0].id : '', toAccountId: secondAccount, taggedAsExpense: false, categoryId: '', installmentPlanId: null };
}

function buildDefaultTransactions() {
  const today = todayIso();
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return [
    { id: 'demo_income', type: 'income', date: firstOfMonth, amount: 12000, description: 'Nómina', accountId: 'acc_nu', categoryId: 'salario', createdAt: Date.now() - 500000 },
    { id: 'demo_expense_food', type: 'expense', date: today, amount: 180, description: 'Tacos', accountId: 'acc_efectivo', categoryId: 'comida', store: null, createdAt: Date.now() - 400000 },
    { id: 'demo_transfer_cash', type: 'transfer', date: today, amount: 800, description: 'Retiro de efectivo', fromAccountId: 'acc_nu', toAccountId: 'acc_efectivo', taggedAsExpense: false, categoryId: null, installmentPlanId: null, store: null, createdAt: Date.now() - 300000 },
    { id: 'demo_transfer_cream', type: 'transfer', date: today, amount: 100, description: 'Crema facial (pagando con TDC)', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'belleza', installmentPlanId: null, store: null, createdAt: Date.now() - 100000 },
    { id: 'demo_transfer_msi1', type: 'transfer', date: today, amount: 150, description: 'Audífonos inalámbricos', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'compras', installmentPlanId: 'demo_msi_audifonos', store: null, createdAt: Date.now() - 50000 },
    { id: 'demo_transfer_msi2', type: 'transfer', date: today, amount: 75, description: 'Audífonos inalámbricos (quincena)', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'compras', installmentPlanId: 'demo_msi_audifonos', store: null, createdAt: Date.now() - 40000 },
  ];
}

function buildDefaultInstallmentPlans() {
  return [
    { id: 'demo_msi_audifonos', description: 'Audífonos inalámbricos', store: 'Walmart', totalAmount: 900, installmentsCount: 6, categoryId: 'compras', startDate: todayIso(), createdAt: Date.now() - 900000 },
  ];
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

function parseCsv(text) {
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

function parseMonefyDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseMonefyAmount(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

function classifyMonefyCategory(raw) {
  const trimmed = (raw || '').trim();
  let m = trimmed.match(MONEFY_TO_RE);
  if (m) return { kind: 'to', otherAccount: m[1].trim() };
  m = trimmed.match(MONEFY_FROM_RE);
  if (m) return { kind: 'from', otherAccount: m[1].trim() };
  m = trimmed.match(MONEFY_INITIAL_RE);
  if (m) return { kind: 'initial', otherAccount: m[1].trim() };
  return { kind: 'plain', category: trimmed };
}

function parseMonefyRows(text) {
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

function guessAccountType(name) {
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

function guessCategoryIcon(name) {
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

function parseOscarDescription(raw) {
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

function buildMonefyImportPreview(rows) {
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

function buildMonefyImportPlan(skeleton, initialBalances, { accountDecisions, existingAccounts, existingCategories, useOscarConvention }) {
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

function SheetOverlay({ onClose, children, desktop }) {
  if (desktop) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center hilo-overlay p-6" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
        <div className="hilo-sheet rounded-3xl overflow-y-auto hilo-scroll w-full max-w-lg" style={{ backgroundColor: COLORS.surface, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end hilo-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="hilo-sheet rounded-t-3xl overflow-y-auto hilo-scroll" style={{ backgroundColor: COLORS.surface, maxHeight: '88%' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
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

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <Receipt size={18} style={{ color: COLORS.textFaint }} />
      </div>
      <p className="text-sm" style={{ color: COLORS.textMuted }}>{text}</p>
    </div>
  );
}

function DonutTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const pct = total ? Math.round((d.total / total) * 100) : 0;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.text }}>
      <p className="font-semibold" style={{ color: d.color }}>{d.name}</p>
      <p className="font-mono-custom">{formatMoney(d.total)} · {pct}%</p>
    </div>
  );
}

function ExpenseDonut({ data, total, onSliceClick }) {
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ArrowDownRight size={20} style={{ color: COLORS.textFaint }} />
        </div>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Aún no hay gastos este mes.<br />Usa el botón + para registrar el primero.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none">
              {data.map(d => (
                <Cell key={d.id} fill={d.color} style={{ cursor: 'pointer', outline: 'none' }} onClick={() => onSliceClick(d.id)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Gastos</span>
          <span className="font-mono-custom font-bold text-xl" style={{ color: COLORS.text }}>{formatMoney(total)}</span>
        </div>
      </div>
      <div className="mt-2">
        {data.map(d => {
          const Icon = IconFor(d.icon);
          const pct = total ? Math.round((d.total / total) * 100) : 0;
          return (
            <button key={d.id} onClick={() => onSliceClick(d.id)} className="w-full flex items-center gap-3 py-2 rounded-lg active:opacity-70 transition-opacity">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <Icon size={14} style={{ color: d.color }} />
              <span className="flex-1 text-left text-sm truncate" style={{ color: COLORS.text }}>{d.name}</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{pct}%</span>
              <span className="font-mono-custom text-sm font-medium" style={{ color: COLORS.text }}>{formatMoney(d.total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryPicker({ categories, type, selectedId, onSelect, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('MoreHorizontal');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]);

  function submit() {
    if (!name.trim()) return;
    onCreate({ id: uid('cat'), name: name.trim(), icon, color, type });
    setName('');
    setIcon('MoreHorizontal');
    setColor(CATEGORY_PALETTE[0]);
    setCreating(false);
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {categories.map(c => {
          const Icon = IconFor(c.icon);
          const isSel = selectedId === c.id;
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: isSel ? c.color : COLORS.border, backgroundColor: isSel ? c.color + '22' : 'transparent' }}>
              <Icon size={17} style={{ color: c.color }} />
              <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>{c.name}</span>
            </button>
          );
        })}
        <button onClick={() => setCreating(v => !v)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: COLORS.border, borderStyle: 'dashed', backgroundColor: creating ? COLORS.surfaceAlt : 'transparent' }}>
          <Plus size={17} style={{ color: COLORS.textMuted }} />
          <span className="text-xs text-center leading-tight" style={{ color: COLORS.textMuted }}>Nueva</span>
        </button>
      </div>

      {creating && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Nueva categoría</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la categoría"
            autoFocus
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-1.5" style={{ color: COLORS.textFaint }}>Color</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {CATEGORY_PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${COLORS.surfaceAlt}, 0 0 0 4px ${c}` : 'none' }} />
            ))}
          </div>
          <p className="text-xs mb-1.5" style={{ color: COLORS.textFaint }}>Ícono</p>
          <div className="grid grid-cols-6 gap-1.5 mb-3" style={{ maxHeight: 128, overflowY: 'auto' }}>
            {ICON_CHOICES.map(iconName => {
              const IconOpt = ICONS[iconName];
              const isSel = icon === iconName;
              return (
                <button key={iconName} onClick={() => setIcon(iconName)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isSel ? color + '33' : COLORS.elevated, border: `1px solid ${isSel ? color : COLORS.border}` }}>
                  <IconOpt size={14} style={{ color: isSel ? color : COLORS.textMuted }} />
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Cancelar</button>
            <button onClick={submit} disabled={!name.trim()} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: color, color: COLORS.bg }}>Crear</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreInput({ value, onChange, knownStores }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tienda (opcional)</p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ej. Walmart, HEB, Amazon"
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      />
      {knownStores.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {knownStores.map(s => (
            <button key={s} type="button" onClick={() => onChange(s)} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: value === s ? COLORS.accentSoft : COLORS.surfaceAlt, color: value === s ? COLORS.accent : COLORS.textMuted, border: `1px solid ${value === s ? COLORS.accent : COLORS.border}` }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InstallmentPlanPicker({ plans, progress, selectedId, onSelect, onCreate, categories, knownStores, onCreateCategory }) {
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [store, setStore] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('6');
  const [categoryId, setCategoryId] = useState(categories[0] ? categories[0].id : '');
  const [startDate, setStartDate] = useState(todayIso());

  const activePlans = plans.filter(p => !(progress[p.id] && progress[p.id].isPaidOff));

  function handleNewCat(cat) {
    onCreateCategory(cat);
    setCategoryId(cat.id);
  }

  const submitValid = description.trim() && parseFloat(totalAmount) > 0 && parseInt(installmentsCount, 10) > 0 && categoryId;

  function submit() {
    if (!submitValid) return;
    const plan = {
      id: uid('msi'),
      description: description.trim(),
      store: store.trim(),
      totalAmount: parseFloat(totalAmount),
      installmentsCount: parseInt(installmentsCount, 10),
      categoryId,
      startDate,
      createdAt: Date.now(),
    };
    onCreate(plan);
    setCreating(false);
    setDescription('');
    setStore('');
    setTotalAmount('');
    setInstallmentsCount('6');
  }

  return (
    <div>
      {activePlans.length > 0 && (
        <div className="space-y-2 mb-2">
          {activePlans.map(p => {
            const prog = progress[p.id] || { paid: 0, installmentsPaid: 0, remaining: p.totalAmount, pct: 0 };
            const isSel = selectedId === p.id;
            return (
              <button key={p.id} onClick={() => onSelect(p.id)} className="w-full text-left p-3 rounded-xl border" style={{ borderColor: isSel ? COLORS.accent : COLORS.border, backgroundColor: isSel ? COLORS.accentSoft : COLORS.surfaceAlt }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{p.description}{p.store ? ` · ${p.store}` : ''}</p>
                  <p className="text-xs font-mono-custom shrink-0" style={{ color: COLORS.textMuted }}>{prog.installmentsPaid.toFixed(1)}/{p.installmentsCount}</p>
                </div>
                <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: COLORS.elevated }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${prog.pct * 100}%`, backgroundColor: COLORS.accent }} />
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.textFaint }}>Quedan {formatMoney(prog.remaining)}</p>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => setCreating(v => !v)} className="w-full py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5" style={{ borderColor: COLORS.border, borderStyle: 'dashed', color: COLORS.textMuted, backgroundColor: creating ? COLORS.surfaceAlt : 'transparent' }}>
        <Plus size={15} /> Nuevo plan de MSI
      </button>

      {creating && (
        <div className="mt-3 rounded-xl p-3 space-y-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿Qué compraste?</p>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Laptop" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
          <StoreInput value={store} onChange={setStore} knownStores={knownStores} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Monto total</p>
              <input type="number" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}># de MSI</p>
              <input type="number" inputMode="numeric" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} placeholder="6" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
          </div>
          {parseFloat(totalAmount) > 0 && parseInt(installmentsCount, 10) > 0 && (
            <p className="text-xs" style={{ color: COLORS.textFaint }}>≈ {formatMoney(parseFloat(totalAmount) / parseInt(installmentsCount, 10))} por pago completo</p>
          )}
          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
            <CategoryPicker categories={categories} type="expense" selectedId={categoryId} onSelect={setCategoryId} onCreate={handleNewCat} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha de compra</p>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Cancelar</button>
            <button onClick={submit} disabled={!submitValid} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>Crear plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MsiPlanCard({ plan, progress, categories, onClick, muted }) {
  const cat = categories.find(c => c.id === plan.categoryId);
  const prog = progress || { paid: 0, installmentsPaid: 0, remaining: plan.totalAmount, pct: 0, isPaidOff: false };
  return (
    <button onClick={onClick} className="w-full text-left p-3 rounded-xl" style={{ backgroundColor: COLORS.surface, opacity: muted ? 0.7 : 1 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: COLORS.text }}>{plan.description}</p>
          <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{plan.store ? plan.store + ' · ' : ''}{cat ? cat.name : ''}</p>
        </div>
        <p className="text-xs font-mono-custom shrink-0" style={{ color: COLORS.textMuted }}>{prog.installmentsPaid.toFixed(1)}/{plan.installmentsCount}</p>
      </div>
      <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <div className="h-1.5 rounded-full" style={{ width: `${prog.pct * 100}%`, backgroundColor: prog.isPaidOff ? COLORS.income : COLORS.accent }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs" style={{ color: COLORS.textFaint }}>{formatMoney(prog.paid)} de {formatMoney(plan.totalAmount)}</p>
        {prog.isPaidOff ? (
          <p className="text-xs font-medium" style={{ color: COLORS.income }}>Pagado ✓</p>
        ) : (
          <p className="text-xs" style={{ color: COLORS.textFaint }}>Quedan {formatMoney(prog.remaining)}</p>
        )}
      </div>
    </button>
  );
}

function TransactionRow({ txn, accounts, categories, plans, onClick }) {
  const accById = (id) => accounts.find(a => a.id === id);

  if (txn.type === 'transfer') {
    const fromAcc = accById(txn.fromAccountId);
    const toAcc = accById(txn.toAccountId);
    const cat = txn.taggedAsExpense ? categories.find(c => c.id === txn.categoryId) : null;
    const CatIcon = cat ? IconFor(cat.icon) : null;
    const plan = txn.installmentPlanId ? (plans || []).find(p => p.id === txn.installmentPlanId) : null;
    return (
      <button onClick={onClick} className="w-full flex items-start gap-3 py-3 border-b text-left" style={{ borderColor: COLORS.border }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.accentSoft }}>
          <ArrowRightLeft size={17} style={{ color: COLORS.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium" style={{ color: COLORS.text }}>{txn.description || 'Transferencia'}</p>
            <p className="font-mono-custom text-sm font-semibold shrink-0" style={{ color: txn.taggedAsExpense ? COLORS.expense : COLORS.text }}>
              {txn.taggedAsExpense ? '-' : ''}{formatMoney(txn.amount)}
            </p>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>{fromAcc ? fromAcc.name : '—'} → {toAcc ? toAcc.name : '—'}</p>
          {cat && CatIcon && (
            <div className="flex items-center gap-1.5 mt-1.5 pl-2" style={{ borderLeft: `2px dashed ${cat.color}` }}>
              <CatIcon size={12} style={{ color: cat.color }} />
              <span className="text-xs font-medium" style={{ color: cat.color }}>Cuenta como gasto · {cat.name}</span>
            </div>
          )}
          {plan && (
            <div className="flex items-center gap-1.5 mt-1 pl-2" style={{ borderLeft: `2px dashed ${COLORS.accent}` }}>
              <Layers size={12} style={{ color: COLORS.accent }} />
              <span className="text-xs font-medium" style={{ color: COLORS.accent }}>MSI · {plan.description}{plan.store ? ` (${plan.store})` : ''}</span>
            </div>
          )}
        </div>
      </button>
    );
  }

  const acc = accById(txn.accountId);
  const cat = categories.find(c => c.id === txn.categoryId);
  const Icon = IconFor(cat ? cat.icon : null);
  const isExpense = txn.type === 'expense';
  const plan = txn.installmentPlanId ? (plans || []).find(p => p.id === txn.installmentPlanId) : null;
  return (
    <button onClick={onClick} className="w-full flex items-start gap-3 py-3 border-b text-left" style={{ borderColor: COLORS.border }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: (cat ? cat.color : COLORS.textMuted) + '26' }}>
        <Icon size={17} style={{ color: cat ? cat.color : COLORS.textMuted }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium" style={{ color: COLORS.text }}>{txn.description || (cat ? cat.name : 'Movimiento')}</p>
          <p className="font-mono-custom text-sm font-semibold shrink-0" style={{ color: isExpense ? COLORS.expense : COLORS.income }}>
            {isExpense ? '-' : '+'}{formatMoney(txn.amount)}
          </p>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>{cat ? cat.name : ''}{cat && acc ? ' · ' : ''}{acc ? acc.name : ''}{txn.store ? ` · ${txn.store}` : ''}</p>
        {plan && (
          <div className="flex items-center gap-1.5 mt-1.5 pl-2" style={{ borderLeft: `2px dashed ${COLORS.accent}` }}>
            <Layers size={12} style={{ color: COLORS.accent }} />
            <span className="text-xs font-medium" style={{ color: COLORS.accent }}>MSI · {plan.description}{plan.store ? ` (${plan.store})` : ''}</span>
          </div>
        )}
      </div>
    </button>
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
/* Views                                                                */
/* ------------------------------------------------------------------ */

function HomeView({ monthCursor, onPrevMonth, onNextMonth, totalBalance, totalIncome, totalExpense, categoryTotals, accounts, balances, recentTxns, categories, installmentPlans, planProgress, onSliceClick, onSeeAll, onSeeMsi, onOpenMsiPlan, onOpenTxn }) {
  const activePlans = installmentPlans.filter(p => !(planProgress[p.id] && planProgress[p.id].isPaidOff));
  return (
    <div className="pt-2">
      <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-bold text-3xl mt-1" style={{ color: COLORS.text }}>{formatMoney(totalBalance)}</p>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={onPrevMonth} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronLeft size={14} style={{ color: COLORS.textMuted }} />
          </button>
          <p className="text-sm font-medium flex-1 text-center" style={{ color: COLORS.text }}>{monthLabel(monthCursor)}</p>
          <button onClick={onNextMonth} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronRight size={14} style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.incomeSoft }}>
            <div className="flex items-center gap-1">
              <ArrowUpRight size={13} style={{ color: COLORS.income }} />
              <span className="text-xs" style={{ color: COLORS.income }}>Ingresos</span>
            </div>
            <p className="font-mono-custom font-semibold mt-1" style={{ color: COLORS.income }}>{formatMoney(totalIncome)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <div className="flex items-center gap-1">
              <ArrowDownRight size={13} style={{ color: COLORS.expense }} />
              <span className="text-xs" style={{ color: COLORS.expense }}>Gastos</span>
            </div>
            <p className="font-mono-custom font-semibold mt-1" style={{ color: COLORS.expense }}>{formatMoney(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-5 mt-4" style={{ backgroundColor: COLORS.surface }}>
        <p className="text-sm font-semibold font-display mb-2" style={{ color: COLORS.text }}>Gastos por categoría</p>
        <ExpenseDonut data={categoryTotals} total={totalExpense} onSliceClick={onSliceClick} />
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold font-display mb-2" style={{ color: COLORS.text }}>Cuentas</p>
        <div className="flex gap-3 overflow-x-auto hilo-scroll pb-1">
          {accounts.map(a => {
            const typeInfo = ACCOUNT_TYPES.find(t => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
            const TypeIcon = typeInfo.icon;
            const bal = balances[a.id] || 0;
            return (
              <div key={a.id} className="shrink-0 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt, minWidth: 130 }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: a.color + '26' }}>
                  <TypeIcon size={15} style={{ color: a.color }} />
                </div>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{a.name}</p>
                <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {activePlans.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses</p>
            <button onClick={onSeeMsi} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
          </div>
          <div className="space-y-2">
            {activePlans.slice(0, 3).map(p => (
              <MsiPlanCard key={p.id} plan={p} progress={planProgress[p.id]} categories={categories} onClick={() => onOpenMsiPlan(p)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Movimientos recientes</p>
          <button onClick={onSeeAll} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
        </div>
        {recentTxns.length === 0 ? (
          <EmptyState text="Aún no hay movimientos este mes." />
        ) : (
          <div>
            {recentTxns.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryView({ transactions, accounts, categories, installmentPlans, knownStores, monthCursor, onPrevMonth, onNextMonth, showAllTime, setShowAllTime, filterType, setFilterType, filterCategory, setFilterCategory, filterStore, setFilterStore, onOpenTxn }) {
  const filtered = useMemo(() => {
    let list = transactions;
    if (!showAllTime) {
      const key = monthKey(monthCursor);
      list = list.filter(t => t.date && t.date.startsWith(key));
    }
    if (filterType === 'msi') list = list.filter(t => !!t.installmentPlanId);
    else if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterCategory !== 'all') {
      list = list.filter(t =>
        (t.type === 'expense' && t.categoryId === filterCategory) ||
        (t.type === 'income' && t.categoryId === filterCategory) ||
        (t.type === 'transfer' && t.taggedAsExpense && t.categoryId === filterCategory)
      );
    }
    if (filterStore !== 'all') list = list.filter(t => t.store === filterStore);
    return list;
  }, [transactions, showAllTime, monthCursor, filterType, filterCategory, filterStore]);

  const groups = groupByDate(filtered);
  const expenseCats = categories.filter(c => c.type === 'expense');
  const typeFilters = [
    { id: 'all', label: 'Todos' },
    { id: 'expense', label: 'Gastos' },
    { id: 'income', label: 'Ingresos' },
    { id: 'transfer', label: 'Transferencias' },
    { id: 'msi', label: 'MSI' },
  ];

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2">
        <button onClick={onPrevMonth} disabled={showAllTime} className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ChevronLeft size={14} style={{ color: COLORS.textMuted }} />
        </button>
        <p className="text-sm font-medium flex-1 text-center" style={{ color: COLORS.text }}>{showAllTime ? 'Todo el tiempo' : monthLabel(monthCursor)}</p>
        <button onClick={onNextMonth} disabled={showAllTime} className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ChevronRight size={14} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <button onClick={() => setShowAllTime(s => !s)} className="text-xs font-medium mt-2" style={{ color: COLORS.accent }}>
        {showAllTime ? 'Ver por mes' : 'Ver todo el tiempo'}
      </button>

      <div className="flex gap-2 mt-3 overflow-x-auto hilo-scroll pb-1">
        {typeFilters.map(f => (
          <button key={f.id} onClick={() => setFilterType(f.id)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: filterType === f.id ? COLORS.accent : COLORS.surfaceAlt, color: filterType === f.id ? COLORS.bg : COLORS.textMuted }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las categorías</option>
          {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las tiendas</option>
          {knownStores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-4">
        {groups.length === 0 ? (
          <EmptyState text="No hay movimientos con estos filtros." />
        ) : groups.map(([label, list]) => (
          <div key={label} className="mt-4 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.textFaint }}>{label}</p>
            {list.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountsView({ accounts, balances, onAdd, onEdit }) {
  const total = Object.values(balances).reduce((s, v) => s + v, 0);
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Tus cuentas</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="space-y-2">
        {accounts.map(a => {
          const typeInfo = ACCOUNT_TYPES.find(t => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
          const TypeIcon = typeInfo.icon;
          const bal = balances[a.id] || 0;
          return (
            <button key={a.id} onClick={() => onEdit(a)} className="w-full flex items-center gap-3 p-3 rounded-xl text-left" style={{ backgroundColor: COLORS.surface }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: a.color + '26' }}>
                <TypeIcon size={17} style={{ color: a.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: COLORS.text }}>{a.name}</p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>{typeInfo.label}</p>
              </div>
              <p className="font-mono-custom text-sm font-semibold" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-semibold text-lg mt-0.5" style={{ color: COLORS.text }}>{formatMoney(total)}</p>
      </div>
    </div>
  );
}

function MsiView({ plans, progress, categories, onAdd, onOpenPlan }) {
  const active = plans.filter(p => !(progress[p.id] && progress[p.id].isPaidOff)).sort((a, b) => b.createdAt - a.createdAt);
  const completed = plans.filter(p => progress[p.id] && progress[p.id].isPaidOff).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses (MSI)</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Nuevo
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Cada pago que hagas se resta del total automáticamente, aunque no sea un pago completo.</p>

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState text="Aún no registras compras a meses. Usa + Nuevo, o marca una transferencia como pago de MSI." />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState text="No tienes MSI activos por pagar." />
          ) : (
            <div className="space-y-2">
              {active.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textFaint }}>Ya pagados</p>
              <div className="space-y-2">
                {completed.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} muted />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop views                                                       */
/* ------------------------------------------------------------------ */
/* Árbol de componentes paralelo al de arriba, usado solo cuando useIsDesktop()
   es true (ver DesktopShell). Aprovecha el ancho con grids multi-columna en
   vez de reflowear las vistas móviles; mismas firmas de props que sus
   contrapartes móviles para poder recibir los mismos datos derivados de App
   sin transformarlos. */

function DesktopSidebar({ active, onChange, onOpenSettings, onAddTransaction }) {
  return (
    <div className="w-60 shrink-0 h-full flex flex-col border-r px-4 py-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      <div className="px-2 mb-8">
        <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
      </div>
      <button onClick={onAddTransaction} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-6" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
        <Plus size={16} /> Nueva transacción
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

function HomeViewDesktop({ monthCursor, onPrevMonth, onNextMonth, totalBalance, totalIncome, totalExpense, categoryTotals, accounts, balances, recentTxns, categories, installmentPlans, planProgress, onSliceClick, onSeeAll, onSeeMsi, onOpenMsiPlan, onOpenTxn }) {
  const activePlans = installmentPlans.filter(p => !(planProgress[p.id] && planProgress[p.id].isPaidOff));
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
              <p className="font-mono-custom font-bold text-4xl mt-1" style={{ color: COLORS.text }}>{formatMoney(totalBalance)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onPrevMonth} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <ChevronLeft size={15} style={{ color: COLORS.textMuted }} />
              </button>
              <p className="text-sm font-medium w-32 text-center" style={{ color: COLORS.text }}>{monthLabel(monthCursor)}</p>
              <button onClick={onNextMonth} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
                <ChevronRight size={15} style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="rounded-xl p-4" style={{ backgroundColor: COLORS.incomeSoft }}>
              <div className="flex items-center gap-1">
                <ArrowUpRight size={14} style={{ color: COLORS.income }} />
                <span className="text-xs" style={{ color: COLORS.income }}>Ingresos</span>
              </div>
              <p className="font-mono-custom font-semibold text-lg mt-1" style={{ color: COLORS.income }}>{formatMoney(totalIncome)}</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: COLORS.expenseSoft }}>
              <div className="flex items-center gap-1">
                <ArrowDownRight size={14} style={{ color: COLORS.expense }} />
                <span className="text-xs" style={{ color: COLORS.expense }}>Gastos</span>
              </div>
              <p className="font-mono-custom font-semibold text-lg mt-1" style={{ color: COLORS.expense }}>{formatMoney(totalExpense)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <p className="text-sm font-semibold font-display mb-3" style={{ color: COLORS.text }}>Gastos por categoría</p>
          <ExpenseDonut data={categoryTotals} total={totalExpense} onSliceClick={onSliceClick} />
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Movimientos recientes</p>
            <button onClick={onSeeAll} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
          </div>
          {recentTxns.length === 0 ? (
            <EmptyState text="Aún no hay movimientos este mes." />
          ) : (
            <div>
              {recentTxns.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} />)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
          <p className="text-sm font-semibold font-display mb-3" style={{ color: COLORS.text }}>Cuentas</p>
          <div className="grid grid-cols-2 gap-3">
            {accounts.map(a => {
              const typeInfo = ACCOUNT_TYPES.find(t => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
              const TypeIcon = typeInfo.icon;
              const bal = balances[a.id] || 0;
              return (
                <div key={a.id} className="rounded-xl p-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: a.color + '26' }}>
                    <TypeIcon size={15} style={{ color: a.color }} />
                  </div>
                  <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>{a.name}</p>
                  <p className="font-mono-custom text-sm font-semibold mt-0.5" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {activePlans.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: COLORS.surface }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses</p>
              <button onClick={onSeeMsi} className="text-xs font-medium" style={{ color: COLORS.accent }}>Ver todo</button>
            </div>
            <div className="space-y-2">
              {activePlans.slice(0, 4).map(p => (
                <MsiPlanCard key={p.id} plan={p} progress={planProgress[p.id]} categories={categories} onClick={() => onOpenMsiPlan(p)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryViewDesktop({ transactions, accounts, categories, installmentPlans, knownStores, monthCursor, onPrevMonth, onNextMonth, showAllTime, setShowAllTime, filterType, setFilterType, filterCategory, setFilterCategory, filterStore, setFilterStore, onOpenTxn }) {
  const filtered = useMemo(() => {
    let list = transactions;
    if (!showAllTime) {
      const key = monthKey(monthCursor);
      list = list.filter(t => t.date && t.date.startsWith(key));
    }
    if (filterType === 'msi') list = list.filter(t => !!t.installmentPlanId);
    else if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterCategory !== 'all') {
      list = list.filter(t =>
        (t.type === 'expense' && t.categoryId === filterCategory) ||
        (t.type === 'income' && t.categoryId === filterCategory) ||
        (t.type === 'transfer' && t.taggedAsExpense && t.categoryId === filterCategory)
      );
    }
    if (filterStore !== 'all') list = list.filter(t => t.store === filterStore);
    return list;
  }, [transactions, showAllTime, monthCursor, filterType, filterCategory, filterStore]);

  const groups = groupByDate(filtered);
  const expenseCats = categories.filter(c => c.type === 'expense');
  const typeFilters = [
    { id: 'all', label: 'Todos' },
    { id: 'expense', label: 'Gastos' },
    { id: 'income', label: 'Ingresos' },
    { id: 'transfer', label: 'Transferencias' },
    { id: 'msi', label: 'MSI' },
  ];

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: COLORS.surface }}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={onPrevMonth} disabled={showAllTime} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronLeft size={15} style={{ color: COLORS.textMuted }} />
          </button>
          <p className="text-sm font-medium w-32 text-center" style={{ color: COLORS.text }}>{showAllTime ? 'Todo el tiempo' : monthLabel(monthCursor)}</p>
          <button onClick={onNextMonth} disabled={showAllTime} className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <ChevronRight size={15} style={{ color: COLORS.textMuted }} />
          </button>
        </div>
        <button onClick={() => setShowAllTime(s => !s)} className="text-xs font-medium" style={{ color: COLORS.accent }}>
          {showAllTime ? 'Ver por mes' : 'Ver todo el tiempo'}
        </button>
        <div className="flex-1" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las categorías</option>
          {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}>
          <option value="all">Todas las tiendas</option>
          {knownStores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mt-4">
        {typeFilters.map(f => (
          <button key={f.id} onClick={() => setFilterType(f.id)} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: filterType === f.id ? COLORS.accent : COLORS.surfaceAlt, color: filterType === f.id ? COLORS.bg : COLORS.textMuted }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {groups.length === 0 ? (
          <EmptyState text="No hay movimientos con estos filtros." />
        ) : groups.map(([label, list]) => (
          <div key={label} className="mt-4 first:mt-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.textFaint }}>{label}</p>
            {list.map(t => <TransactionRow key={t.id} txn={t} accounts={accounts} categories={categories} plans={installmentPlans} onClick={() => onOpenTxn(t)} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountsViewDesktop({ accounts, balances, onAdd, onEdit }) {
  const total = Object.values(balances).reduce((s, v) => s + v, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Tus cuentas</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Agregar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {accounts.map(a => {
          const typeInfo = ACCOUNT_TYPES.find(t => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
          const TypeIcon = typeInfo.icon;
          const bal = balances[a.id] || 0;
          return (
            <button key={a.id} onClick={() => onEdit(a)} className="text-left p-5 rounded-2xl" style={{ backgroundColor: COLORS.surface }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: a.color + '26' }}>
                <TypeIcon size={19} style={{ color: a.color }} />
              </div>
              <p className="text-sm font-medium" style={{ color: COLORS.text }}>{a.name}</p>
              <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>{typeInfo.label}</p>
              <p className="font-mono-custom text-lg font-semibold mt-3" style={{ color: bal < 0 ? COLORS.expense : COLORS.text }}>{formatMoney(bal)}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-xl p-4 inline-block" style={{ backgroundColor: COLORS.surfaceAlt }}>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Saldo total</p>
        <p className="font-mono-custom font-semibold text-lg mt-0.5" style={{ color: COLORS.text }}>{formatMoney(total)}</p>
      </div>
    </div>
  );
}

function MsiViewDesktop({ plans, progress, categories, onAdd, onOpenPlan }) {
  const active = plans.filter(p => !(progress[p.id] && progress[p.id].isPaidOff)).sort((a, b) => b.createdAt - a.createdAt);
  const completed = plans.filter(p => progress[p.id] && progress[p.id].isPaidOff).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold font-display" style={{ color: COLORS.text }}>Compras a meses (MSI)</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: COLORS.accentSoft, color: COLORS.accent }}>
          <Plus size={13} /> Nuevo
        </button>
      </div>
      <p className="text-xs mb-4" style={{ color: COLORS.textFaint }}>Cada pago que hagas se resta del total automáticamente, aunque no sea un pago completo.</p>

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState text="Aún no registras compras a meses. Usa + Nuevo, o marca una transferencia como pago de MSI." />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState text="No tienes MSI activos por pagar." />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {active.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textFaint }}>Ya pagados</p>
              <div className="grid grid-cols-2 gap-3">
                {completed.map(p => <MsiPlanCard key={p.id} plan={p} progress={progress[p.id]} categories={categories} onClick={() => onOpenPlan(p)} muted />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modals / sheets                                                      */
/* ------------------------------------------------------------------ */

function AddTransactionSheet({ formType, editingId, form, setForm, accounts, categories, plans, planProgress, knownStores, onClose, onSave, onDelete, onSwitchType, onCreateCategory, onCreatePlan, desktop }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expenseMode, setExpenseMode] = useState(form && form.installmentPlanId ? 'msi' : 'single');
  useEffect(() => {
    setExpenseMode(form && form.installmentPlanId ? 'msi' : 'single');
  }, [formType]);
  if (!form) return null;

  const expenseCats = categories.filter(c => c.type === 'expense');
  const incomeCats = categories.filter(c => c.type === 'income');
  const catList = formType === 'income' ? incomeCats : expenseCats;

  function handleNewCategory(cat) {
    onCreateCategory(cat);
    setForm(f => ({ ...f, categoryId: cat.id }));
  }

  function handleNewPlan(plan) {
    onCreatePlan(plan);
    setForm(f => ({ ...f, installmentPlanId: plan.id, categoryId: plan.categoryId, description: f.description || plan.description }));
  }

  const isValid = useMemo(() => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return false;
    if (formType === 'transfer') {
      if (!form.fromAccountId || !form.toAccountId || form.fromAccountId === form.toAccountId) return false;
      if (form.taggedAsExpense) {
        if (expenseMode === 'msi') {
          if (!form.installmentPlanId) return false;
        } else if (!form.categoryId) {
          return false;
        }
      }
      return true;
    }
    if (formType === 'expense' && expenseMode === 'msi' && !form.installmentPlanId) return false;
    if (!form.accountId || !form.categoryId) return false;
    return true;
  }, [form, formType, expenseMode]);

  const typeMeta = {
    expense: { label: 'Gasto', color: COLORS.expense },
    income: { label: 'Ingreso', color: COLORS.income },
    transfer: { label: 'Transferencia', color: COLORS.accent },
  };

  const toOptions = accounts.filter(a => a.id !== form.fromAccountId);

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>
          {editingId ? `Editar ${typeMeta[formType].label.toLowerCase()}` : 'Nuevo movimiento'}
        </p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      {!editingId && (
        <div className="flex gap-2 p-1 rounded-2xl mx-5 mt-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          {['expense', 'income', 'transfer'].map(t => (
            <button key={t} onClick={() => onSwitchType(t)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors" style={{ backgroundColor: formType === t ? typeMeta[t].color : 'transparent', color: formType === t ? COLORS.bg : COLORS.textMuted }}>
              {typeMeta[t].label}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 mt-5 flex items-center justify-center gap-1">
        <span className="font-mono-custom text-2xl" style={{ color: COLORS.textMuted }}>$</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          className="bg-transparent outline-none font-mono-custom text-4xl font-bold text-center w-40"
          style={{ color: COLORS.text }}
          autoFocus
        />
      </div>
      <p className="text-center text-xs mb-1" style={{ color: COLORS.textFaint }}>MXN</p>

      {formType !== 'transfer' && (
        <div className="px-5 mt-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
          <CategoryPicker categories={catList} type={formType} selectedId={form.categoryId} onSelect={(id) => setForm(f => ({ ...f, categoryId: id }))} onCreate={handleNewCategory} />
        </div>
      )}

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>{formType === 'transfer' ? 'Desde' : 'Cuenta'}</p>
        <div className="flex gap-2 overflow-x-auto hilo-scroll pb-1">
          {accounts.map(a => {
            const selId = formType === 'transfer' ? form.fromAccountId : form.accountId;
            const isSel = selId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => formType === 'transfer'
                  ? setForm(f => ({ ...f, fromAccountId: a.id, toAccountId: f.toAccountId === a.id ? (accounts.find(x => x.id !== a.id) ? accounts.find(x => x.id !== a.id).id : '') : f.toAccountId }))
                  : setForm(f => ({ ...f, accountId: a.id }))
                }
                className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: isSel ? a.color : COLORS.border, backgroundColor: isSel ? a.color + '22' : 'transparent', color: COLORS.text }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      {formType === 'transfer' && (
        <div className="px-5 mt-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Hacia</p>
          {toOptions.length === 0 ? (
            <p className="text-xs" style={{ color: COLORS.textFaint }}>Necesitas al menos otra cuenta para transferir. Agrega una en la pestaña Cuentas.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto hilo-scroll pb-1">
              {toOptions.map(a => {
                const isSel = form.toAccountId === a.id;
                return (
                  <button key={a.id} onClick={() => setForm(f => ({ ...f, toAccountId: a.id }))} className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: isSel ? a.color : COLORS.border, backgroundColor: isSel ? a.color + '22' : 'transparent', color: COLORS.text }}>
                    {a.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {formType === 'expense' && (
        <div className="px-5 mt-5">
          <button onClick={() => { const next = expenseMode === 'msi' ? 'single' : 'msi'; setExpenseMode(next); if (next === 'single') setForm(f => ({ ...f, installmentPlanId: null })); }} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <Layers size={16} style={{ color: COLORS.accent }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Vincular a un plan de MSI</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors" style={{ backgroundColor: expenseMode === 'msi' ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: expenseMode === 'msi' ? 18 : 2 }} />
            </div>
          </button>
          {expenseMode === 'msi' && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué plan de MSI pertenece este pago?</p>
              <InstallmentPlanPicker
                plans={plans}
                progress={planProgress}
                selectedId={form.installmentPlanId}
                onSelect={(id) => {
                  const p = plans.find(x => x.id === id);
                  setForm(f => ({ ...f, installmentPlanId: id, categoryId: p ? p.categoryId : f.categoryId, description: f.description || (p ? p.description : f.description) }));
                }}
                onCreate={handleNewPlan}
                categories={expenseCats}
                knownStores={knownStores}
                onCreateCategory={handleNewCategory}
              />
            </div>
          )}
        </div>
      )}

      {formType === 'transfer' && (
        <div className="px-5 mt-5">
          <button onClick={() => setForm(f => ({ ...f, taggedAsExpense: !f.taggedAsExpense }))} className="w-full flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center gap-2">
              <Link2 size={16} style={{ color: COLORS.accent }} />
              <span className="text-sm font-medium" style={{ color: COLORS.text }}>Marcar como gasto</span>
            </div>
            <div className="w-10 h-6 rounded-full relative transition-colors" style={{ backgroundColor: form.taggedAsExpense ? COLORS.accent : COLORS.border }}>
              <div className="w-5 h-5 rounded-full absolute top-0.5 transition-all" style={{ backgroundColor: COLORS.bg, left: form.taggedAsExpense ? 18 : 2 }} />
            </div>
          </button>
          <p className="text-xs mt-2 px-1" style={{ color: COLORS.textFaint }}>
            Actívalo si esta transferencia paga algo que ya compraste a crédito (como tu TDC) y quieres que cuente como gasto en tus reportes por categoría, aunque el dinero técnicamente siga siendo tuyo.
          </p>
          {form.taggedAsExpense && (
            <div className="mt-3">
              <div className="flex gap-2 p-1 rounded-xl mb-3" style={{ backgroundColor: COLORS.elevated }}>
                <button onClick={() => { setExpenseMode('single'); setForm(f => ({ ...f, installmentPlanId: null })); }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: expenseMode === 'single' ? COLORS.accent : 'transparent', color: expenseMode === 'single' ? COLORS.bg : COLORS.textMuted }}>
                  Gasto único
                </button>
                <button onClick={() => setExpenseMode('msi')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: expenseMode === 'msi' ? COLORS.accent : 'transparent', color: expenseMode === 'msi' ? COLORS.bg : COLORS.textMuted }}>
                  Pago de MSI
                </button>
              </div>

              {expenseMode === 'single' ? (
                <>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué categoría de gasto pertenece?</p>
                  <CategoryPicker categories={expenseCats} type="expense" selectedId={form.categoryId} onSelect={(id) => setForm(f => ({ ...f, categoryId: id }))} onCreate={handleNewCategory} />
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿A qué plan de MSI pertenece este pago?</p>
                  <InstallmentPlanPicker
                    plans={plans}
                    progress={planProgress}
                    selectedId={form.installmentPlanId}
                    onSelect={(id) => {
                      const p = plans.find(x => x.id === id);
                      setForm(f => ({ ...f, installmentPlanId: id, categoryId: p ? p.categoryId : f.categoryId, description: f.description || (p ? p.description : f.description) }));
                    }}
                    onCreate={handleNewPlan}
                    categories={expenseCats}
                    knownStores={knownStores}
                    onCreateCategory={handleNewCategory}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 mt-5 space-y-3">
        <div>
          <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Descripción (opcional)</p>
          <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={formType === 'transfer' ? 'Ej. Crema facial (TDC)' : 'Ej. Tacos, Uber, Renta'} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
        </div>
        {(formType === 'expense' || (formType === 'transfer' && form.taggedAsExpense && expenseMode !== 'msi')) && (
          <StoreInput value={form.store || ''} onChange={(v) => setForm(f => ({ ...f, store: v }))} knownStores={knownStores} />
        )}
        {formType === 'expense' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tamaño</p>
              <input type="text" value={form.size || ''} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="Ej. 1L" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Marca</p>
              <input type="text" value={form.brand || ''} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej. Lala" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
            <div>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Cantidad</p>
              <input type="text" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Ej. 2" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
            </div>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha</p>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />
        </div>
      </div>

      <div className="px-5 mt-6 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Eliminar este movimiento?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => onDelete(editingId)} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {editingId && (
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={18} />
              </button>
            )}
            <button disabled={!isValid} onClick={() => onSave(form)} className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: typeMeta[formType].color, color: COLORS.bg }}>
              {editingId ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}

function AccountFormModal({ account, canDelete, onClose, onSave, onDelete, desktop }) {
  const [name, setName] = useState(account ? account.name : '');
  const [type, setType] = useState(account ? account.type : 'debito');
  const [color, setColor] = useState(account ? account.color : CATEGORY_PALETTE[0]);
  const [initialBalance, setInitialBalance] = useState(account ? String(account.initialBalance) : '0');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isValid = name.trim().length > 0;

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>{account ? 'Editar cuenta' : 'Nueva cuenta'}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      <div className="px-5 mt-3">
        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Nombre</p>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. NU, Mercado Pago, Efectivo" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tipo de cuenta</p>
        <div className="grid grid-cols-3 gap-2">
          {ACCOUNT_TYPES.map(t => {
            const Icon = t.icon;
            const isSel = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)} className="flex flex-col items-center gap-1 py-2 rounded-xl border" style={{ borderColor: isSel ? color : COLORS.border, backgroundColor: isSel ? color + '22' : 'transparent' }}>
                <Icon size={16} style={{ color: isSel ? color : COLORS.textMuted }} />
                <span className="text-xs text-center leading-tight" style={{ color: COLORS.text }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Color</p>
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full" style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${COLORS.bg}, 0 0 0 4px ${c}` : 'none' }} />
          ))}
        </div>
      </div>

      <div className="px-5 mt-4">
        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Saldo inicial</p>
        <input type="number" inputMode="decimal" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
      </div>

      <div className="px-5 mt-6 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Eliminar esta cuenta?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={onDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {account && (
              <button onClick={() => canDelete && setConfirmDelete(true)} disabled={!canDelete} className="px-4 py-3 rounded-xl disabled:opacity-30" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={17} />
              </button>
            )}
            <button disabled={!isValid} onClick={() => onSave({ id: account ? account.id : undefined, name: name.trim(), type, color, initialBalance: parseFloat(initialBalance) || 0 })} className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
              {account ? 'Guardar cambios' : 'Crear cuenta'}
            </button>
          </div>
        )}
        {!canDelete && account && !confirmDelete && (
          <p className="mt-2 text-xs" style={{ color: COLORS.textFaint }}>Esta cuenta tiene movimientos registrados, así que no se puede eliminar.</p>
        )}
      </div>
    </SheetOverlay>
  );
}

function MsiPlanModal({ plan, progress, payments, categories, knownStores, onClose, onSave, onDelete, onCreateCategory, desktop }) {
  const [description, setDescription] = useState(plan ? plan.description : '');
  const [store, setStore] = useState(plan ? (plan.store || '') : '');
  const [totalAmount, setTotalAmount] = useState(plan ? String(plan.totalAmount) : '');
  const [installmentsCount, setInstallmentsCount] = useState(plan ? String(plan.installmentsCount) : '6');
  const [categoryId, setCategoryId] = useState(plan ? plan.categoryId : (categories[0] ? categories[0].id : ''));
  const [startDate, setStartDate] = useState(plan ? plan.startDate : todayIso());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isValid = description.trim().length > 0 && parseFloat(totalAmount) > 0 && parseInt(installmentsCount, 10) > 0 && !!categoryId;

  function handleNewCat(cat) {
    onCreateCategory(cat);
    setCategoryId(cat.id);
  }

  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>{plan ? 'Editar plan MSI' : 'Nuevo plan MSI'}</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>

      <div className="px-5 mt-3">
        {plan && progress && (
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: COLORS.textMuted }}>Progreso</p>
              <p className="text-xs font-mono-custom" style={{ color: COLORS.text }}>{progress.installmentsPaid.toFixed(1)}/{plan.installmentsCount}</p>
            </div>
            <div className="w-full h-2 rounded-full mt-2" style={{ backgroundColor: COLORS.elevated }}>
              <div className="h-2 rounded-full" style={{ width: `${progress.pct * 100}%`, backgroundColor: progress.isPaidOff ? COLORS.income : COLORS.accent }} />
            </div>
            <p className="text-xs mt-1.5" style={{ color: COLORS.textFaint }}>{formatMoney(progress.paid)} pagado · {formatMoney(progress.remaining)} restante</p>
          </div>
        )}

        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>¿Qué compraste?</p>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej. Laptop" className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />

        <div className="mb-3">
          <StoreInput value={store} onChange={setStore} knownStores={knownStores} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Monto total</p>
            <input type="number" inputMode="decimal" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}># de MSI</p>
            <input type="number" inputMode="numeric" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none font-mono-custom" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }} />
          </div>
        </div>
        {parseFloat(totalAmount) > 0 && parseInt(installmentsCount, 10) > 0 && (
          <p className="text-xs -mt-2 mb-3" style={{ color: COLORS.textFaint }}>≈ {formatMoney(parseFloat(totalAmount) / parseInt(installmentsCount, 10))} por pago completo</p>
        )}

        <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Categoría</p>
        <div className="mb-3">
          <CategoryPicker categories={categories} type="expense" selectedId={categoryId} onSelect={setCategoryId} onCreate={handleNewCat} />
        </div>

        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Fecha de compra</p>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-4" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, colorScheme: 'dark' }} />

        {payments && payments.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: COLORS.textMuted }}>Pagos registrados</p>
            <div className="space-y-1.5">
              {payments.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: COLORS.surfaceAlt }}>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>{formatDateLabel(t.date)}</p>
                  <p className="text-xs font-mono-custom" style={{ color: COLORS.text }}>{formatMoney(t.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 mt-2 mb-6">
        {confirmDelete ? (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>
              {payments && payments.length > 0 ? 'Esto elimina el plan. Tus pagos ya registrados se quedan, solo dejan de agruparse como MSI. ¿Continuar?' : '¿Eliminar este plan de MSI?'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={onDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Eliminar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            {plan && (
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-3 rounded-xl" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>
                <Trash2 size={17} />
              </button>
            )}
            <button
              disabled={!isValid}
              onClick={() => onSave({ id: plan ? plan.id : undefined, description: description.trim(), store: store.trim(), totalAmount: parseFloat(totalAmount) || 0, installmentsCount: parseInt(installmentsCount, 10) || 1, categoryId, startDate })}
              className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
              style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}
            >
              {plan ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}

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

function SettingsModal({ onClose, onResetTransactions, onOpenImport, desktop }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
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
        <button onClick={onOpenImport} className="w-full py-3 rounded-xl text-sm font-semibold mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Importar desde Monefy</button>
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
    monthCursor, onPrevMonth, onNextMonth,
    totalBalance, totalIncome, totalExpense, categoryTotals,
    accounts, balances, recentTxns, categories, installmentPlans, planProgress,
    onSliceClick, onOpenMsiPlan, onOpenTxn,
    transactions, knownStores,
    showAllTime, setShowAllTime, filterType, setFilterType, filterCategory, setFilterCategory, filterStore, setFilterStore,
    onAddAccount, onEditAccount,
    onAddPlan,
    onOpenAddSheet, onOpenSettings,
    sheetOpen, formType, editingId, form, setForm, onCloseSheet, onSaveTransaction, onDeleteTransaction, onSwitchFormType, onCreateCategory, onCreatePlan,
    accountModalOpen, editingAccount, onCloseAccountModal, onSaveAccount, onDeleteAccount, accountCanDelete,
    msiModalOpen, editingPlan, msiPayments, onCloseMsiModal, onSavePlan, onDeletePlan,
    settingsOpen, onCloseSettings, onResetTransactions,
    importModalOpen, onOpenImport, onCloseImportModal, onConfirmImport,
    toast,
  } = props;

  const tabTitles = { home: 'Inicio', history: 'Historial', msi: 'Compras a meses', accounts: 'Cuentas' };

  return (
    <div className="w-full h-screen flex" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyles />
      <DesktopSidebar active={activeTab} onChange={setActiveTab} onOpenSettings={onOpenSettings} onAddTransaction={() => onOpenAddSheet('expense')} />

      <div className="flex-1 h-full overflow-y-auto hilo-scroll relative">
        <div className="max-w-6xl mx-auto px-10 py-8">
          <h2 className="text-2xl font-semibold font-display mb-6" style={{ color: COLORS.text }}>{tabTitles[activeTab]}</h2>

          {activeTab === 'home' && (
            <HomeViewDesktop
              monthCursor={monthCursor}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              totalBalance={totalBalance}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              categoryTotals={categoryTotals}
              accounts={accounts}
              balances={balances}
              recentTxns={recentTxns}
              categories={categories}
              installmentPlans={installmentPlans}
              planProgress={planProgress}
              onSliceClick={onSliceClick}
              onSeeAll={() => setActiveTab('history')}
              onSeeMsi={() => setActiveTab('msi')}
              onOpenMsiPlan={onOpenMsiPlan}
              onOpenTxn={onOpenTxn}
            />
          )}
          {activeTab === 'history' && (
            <HistoryViewDesktop
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              installmentPlans={installmentPlans}
              knownStores={knownStores}
              monthCursor={monthCursor}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              showAllTime={showAllTime}
              setShowAllTime={setShowAllTime}
              filterType={filterType}
              setFilterType={setFilterType}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterStore={filterStore}
              setFilterStore={setFilterStore}
              onOpenTxn={onOpenTxn}
            />
          )}
          {activeTab === 'msi' && (
            <MsiViewDesktop
              plans={installmentPlans}
              progress={planProgress}
              categories={categories}
              onAdd={onAddPlan}
              onOpenPlan={onOpenMsiPlan}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountsViewDesktop
              accounts={accounts}
              balances={balances}
              onAdd={onAddAccount}
              onEdit={onEditAccount}
            />
          )}
        </div>

        {toast && <Toast message={toast} desktop />}
      </div>

      {sheetOpen && (
        <AddTransactionSheet
          formType={formType}
          editingId={editingId}
          form={form}
          setForm={setForm}
          accounts={accounts}
          categories={categories}
          plans={installmentPlans}
          planProgress={planProgress}
          knownStores={knownStores}
          onClose={onCloseSheet}
          onSave={onSaveTransaction}
          onDelete={onDeleteTransaction}
          onSwitchType={onSwitchFormType}
          onCreateCategory={onCreateCategory}
          onCreatePlan={onCreatePlan}
          desktop
        />
      )}

      {accountModalOpen && (
        <AccountFormModal
          account={editingAccount}
          canDelete={accountCanDelete}
          onClose={onCloseAccountModal}
          onSave={onSaveAccount}
          onDelete={onDeleteAccount}
          desktop
        />
      )}

      {msiModalOpen && (
        <MsiPlanModal
          plan={editingPlan}
          progress={editingPlan ? planProgress[editingPlan.id] : null}
          payments={msiPayments}
          categories={categories.filter(c => c.type === 'expense')}
          knownStores={knownStores}
          onClose={onCloseMsiModal}
          onSave={onSavePlan}
          onDelete={onDeletePlan}
          onCreateCategory={onCreateCategory}
          desktop
        />
      )}

      {settingsOpen && (
        <SettingsModal onClose={onCloseSettings} onResetTransactions={onResetTransactions} onOpenImport={onOpenImport} desktop />
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [accounts, setAccounts] = useState(DEFAULT_ACCOUNTS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState(() => buildDefaultTransactions());
  const [installmentPlans, setInstallmentPlans] = useState(() => buildDefaultInstallmentPlans());

  const [activeTab, setActiveTab] = useState('home');
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [showAllTime, setShowAllTime] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStore, setFilterStore] = useState('all');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [formType, setFormType] = useState('expense');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [msiModalOpen, setMsiModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await loadState();
        if (mounted && data) {
          if (data.accounts) setAccounts(data.accounts);
          if (data.categories) setCategories(data.categories);
          if (data.transactions) setTransactions(data.transactions);
          if (data.installmentPlans) setInstallmentPlans(data.installmentPlans);
        }
      } catch (e) {
        // sin datos previos: nos quedamos con los valores de ejemplo
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await saveState({ accounts, categories, transactions, installmentPlans });
      } catch (e) {
        setToast('No se pudo guardar el cambio localmente');
      }
    })();
  }, [accounts, categories, transactions, installmentPlans, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const balances = useMemo(() => {
    const map = {};
    for (const a of accounts) map[a.id] = computeAccountBalance(a, transactions);
    return map;
  }, [accounts, transactions]);

  const totalBalance = useMemo(() => Object.values(balances).reduce((s, v) => s + v, 0), [balances]);

  const periodKey = monthKey(monthCursor);
  const periodTransactions = useMemo(
    () => transactions.filter(t => t.date && t.date.startsWith(periodKey)),
    [transactions, periodKey]
  );

  const totalIncome = useMemo(
    () => periodTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [periodTransactions]
  );

  const totalExpense = useMemo(() => periodTransactions.reduce((s, t) => {
    if (t.type === 'expense') return s + t.amount;
    if (t.type === 'transfer' && t.taggedAsExpense) return s + t.amount;
    return s;
  }, 0), [periodTransactions]);

  const categoryTotals = useMemo(() => {
    const map = {};
    for (const t of periodTransactions) {
      let catId = null;
      if (t.type === 'expense') catId = t.categoryId;
      else if (t.type === 'transfer' && t.taggedAsExpense) catId = t.categoryId;
      if (!catId) continue;
      map[catId] = (map[catId] || 0) + t.amount;
    }
    return Object.entries(map).map(([id, total]) => {
      const cat = categories.find(c => c.id === id);
      return { id, total, name: cat ? cat.name : 'Otros', color: cat ? cat.color : COLORS.textMuted, icon: cat ? cat.icon : 'MoreHorizontal' };
    }).sort((a, b) => b.total - a.total);
  }, [periodTransactions, categories]);

  const recentTxns = useMemo(
    () => [...periodTransactions].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5),
    [periodTransactions]
  );

  const planProgress = useMemo(() => {
    const map = {};
    for (const p of installmentPlans) {
      const paid = transactions.filter(t => (t.type === 'transfer' || t.type === 'expense') && t.installmentPlanId === p.id).reduce((s, t) => s + t.amount, 0);
      const per = p.installmentsCount > 0 ? p.totalAmount / p.installmentsCount : 0;
      const installmentsPaid = per > 0 ? paid / per : 0;
      const remaining = Math.max(p.totalAmount - paid, 0);
      const pct = p.totalAmount > 0 ? Math.min(paid / p.totalAmount, 1) : 0;
      const isPaidOff = p.totalAmount > 0 && paid >= p.totalAmount - 0.005;
      map[p.id] = { paid, per, installmentsPaid, remaining, pct, isPaidOff };
    }
    return map;
  }, [installmentPlans, transactions]);

  const knownStores = useMemo(() => {
    const set = new Set();
    transactions.forEach(t => { if (t.store) set.add(t.store); });
    installmentPlans.forEach(p => { if (p.store) set.add(p.store); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions, installmentPlans]);

  const isDesktop = useIsDesktop();

  function prevMonth() { setMonthCursor(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() - 1); return nd; }); }
  function nextMonth() { setMonthCursor(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() + 1); return nd; }); }

  function openAddSheet(type) {
    setEditingId(null);
    setFormType(type);
    setForm(initialFormState(type, accounts, categories));
    setSheetOpen(true);
  }
  function openEditSheet(txn) {
    setEditingId(txn.id);
    setFormType(txn.type);
    setForm({ ...txn, amount: String(txn.amount) });
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
    setForm(null);
    setEditingId(null);
  }

  function handleSaveTransaction(payload) {
    const amount = parseFloat(payload.amount);
    const base = { date: payload.date || todayIso(), description: (payload.description || '').trim(), amount };
    let txn;
    if (formType === 'expense') {
      txn = {
        ...base, type: 'expense', accountId: payload.accountId, categoryId: payload.categoryId, store: (payload.store || '').trim() || null,
        installmentPlanId: payload.installmentPlanId || null,
        size: (payload.size || '').trim() || null,
        brand: (payload.brand || '').trim() || null,
        quantity: (payload.quantity || '').trim() || null,
      };
    } else if (formType === 'income') {
      txn = { ...base, type: 'income', accountId: payload.accountId, categoryId: payload.categoryId };
    } else {
      const isMsi = !!(payload.taggedAsExpense && payload.installmentPlanId);
      txn = {
        ...base,
        type: 'transfer',
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        taggedAsExpense: !!payload.taggedAsExpense,
        categoryId: payload.taggedAsExpense ? payload.categoryId : null,
        installmentPlanId: isMsi ? payload.installmentPlanId : null,
        store: (payload.taggedAsExpense && !isMsi) ? ((payload.store || '').trim() || null) : null,
      };
    }

    if (editingId) {
      setTransactions(prev => prev.map(t => t.id === editingId ? { ...t, ...txn } : t));
      setToast('Movimiento actualizado');
    } else {
      setTransactions(prev => [...prev, { ...txn, id: uid('txn'), createdAt: Date.now() }]);
      setToast('Movimiento agregado');
    }
    closeSheet();
  }

  function handleDeleteTransaction(id) {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setToast('Movimiento eliminado');
    closeSheet();
  }

  function accountHasTransactions(id) {
    return transactions.some(t => t.accountId === id || t.fromAccountId === id || t.toAccountId === id);
  }

  function handleSaveAccount(payload) {
    if (payload.id) {
      setAccounts(prev => prev.map(a => a.id === payload.id ? { ...a, ...payload } : a));
      setToast('Cuenta actualizada');
    } else {
      setAccounts(prev => [...prev, { ...payload, id: uid('acc') }]);
      setToast('Cuenta creada');
    }
    setAccountModalOpen(false);
    setEditingAccount(null);
  }

  function handleDeleteAccount(id) {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setAccountModalOpen(false);
    setEditingAccount(null);
    setToast('Cuenta eliminada');
  }

  function handleSliceClick(categoryId) {
    setFilterCategory(categoryId);
    setFilterType('all');
    setShowAllTime(false);
    setActiveTab('history');
  }

  function handleResetTransactions() {
    setTransactions([]);
    setToast('Movimientos borrados');
  }

  function openImportModal() {
    setSettingsOpen(false);
    setImportModalOpen(true);
  }

  function handleImportMonefy(plan) {
    if (plan.accountsToAdd.length) setAccounts(prev => [...prev, ...plan.accountsToAdd]);
    if (plan.categoriesToAdd.length) setCategories(prev => [...prev, ...plan.categoriesToAdd]);
    if (plan.installmentPlansToAdd && plan.installmentPlansToAdd.length) setInstallmentPlans(prev => [...prev, ...plan.installmentPlansToAdd]);
    setTransactions(prev => [...prev, ...plan.transactions]);
    setToast(`Se importaron ${plan.transactions.length} movimientos de Monefy`);
  }

  function handleCreateCategory(cat) {
    setCategories(prev => [...prev, cat]);
    setToast('Categoría creada');
  }

  function handleCreatePlan(plan) {
    setInstallmentPlans(prev => [...prev, plan]);
    setToast('Plan de MSI creado');
  }

  function handleSavePlan(payload) {
    if (payload.id) {
      setInstallmentPlans(prev => prev.map(p => p.id === payload.id ? { ...p, ...payload } : p));
      setToast('Plan actualizado');
    } else {
      setInstallmentPlans(prev => [...prev, { ...payload, id: uid('msi'), createdAt: Date.now() }]);
      setToast('Plan creado');
    }
    setMsiModalOpen(false);
    setEditingPlan(null);
  }

  function handleDeletePlan(id) {
    setInstallmentPlans(prev => prev.filter(p => p.id !== id));
    setMsiModalOpen(false);
    setEditingPlan(null);
    setToast('Plan eliminado');
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
        monthCursor={monthCursor}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        totalBalance={totalBalance}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        categoryTotals={categoryTotals}
        accounts={accounts}
        balances={balances}
        recentTxns={recentTxns}
        categories={categories}
        installmentPlans={installmentPlans}
        planProgress={planProgress}
        onSliceClick={handleSliceClick}
        onOpenMsiPlan={(p) => { setEditingPlan(p); setMsiModalOpen(true); }}
        onOpenTxn={openEditSheet}
        transactions={transactions}
        knownStores={knownStores}
        showAllTime={showAllTime}
        setShowAllTime={setShowAllTime}
        filterType={filterType}
        setFilterType={setFilterType}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterStore={filterStore}
        setFilterStore={setFilterStore}
        onAddAccount={() => { setEditingAccount(null); setAccountModalOpen(true); }}
        onEditAccount={(a) => { setEditingAccount(a); setAccountModalOpen(true); }}
        onAddPlan={() => { setEditingPlan(null); setMsiModalOpen(true); }}
        onOpenAddSheet={openAddSheet}
        onOpenSettings={() => setSettingsOpen(true)}
        sheetOpen={sheetOpen}
        formType={formType}
        editingId={editingId}
        form={form}
        setForm={setForm}
        onCloseSheet={closeSheet}
        onSaveTransaction={handleSaveTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onSwitchFormType={(t) => { setFormType(t); setForm(initialFormState(t, accounts, categories)); }}
        onCreateCategory={handleCreateCategory}
        onCreatePlan={handleCreatePlan}
        accountModalOpen={accountModalOpen}
        editingAccount={editingAccount}
        onCloseAccountModal={() => { setAccountModalOpen(false); setEditingAccount(null); }}
        onSaveAccount={handleSaveAccount}
        onDeleteAccount={() => editingAccount && handleDeleteAccount(editingAccount.id)}
        accountCanDelete={editingAccount ? !accountHasTransactions(editingAccount.id) : false}
        msiModalOpen={msiModalOpen}
        editingPlan={editingPlan}
        msiPayments={editingPlan ? transactions.filter(t => t.installmentPlanId === editingPlan.id).sort((a, b) => b.date.localeCompare(a.date)) : []}
        onCloseMsiModal={() => { setMsiModalOpen(false); setEditingPlan(null); }}
        onSavePlan={handleSavePlan}
        onDeletePlan={() => editingPlan && handleDeletePlan(editingPlan.id)}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onResetTransactions={handleResetTransactions}
        importModalOpen={importModalOpen}
        onOpenImport={openImportModal}
        onCloseImportModal={() => setImportModalOpen(false)}
        onConfirmImport={handleImportMonefy}
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
          <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <Settings size={16} style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hilo-scroll px-5 pb-24">
          {activeTab === 'home' && (
            <HomeView
              monthCursor={monthCursor}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              totalBalance={totalBalance}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              categoryTotals={categoryTotals}
              accounts={accounts}
              balances={balances}
              recentTxns={recentTxns}
              categories={categories}
              installmentPlans={installmentPlans}
              planProgress={planProgress}
              onSliceClick={handleSliceClick}
              onSeeAll={() => setActiveTab('history')}
              onSeeMsi={() => setActiveTab('msi')}
              onOpenMsiPlan={(p) => { setEditingPlan(p); setMsiModalOpen(true); }}
              onOpenTxn={openEditSheet}
            />
          )}
          {activeTab === 'history' && (
            <HistoryView
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              installmentPlans={installmentPlans}
              knownStores={knownStores}
              monthCursor={monthCursor}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              showAllTime={showAllTime}
              setShowAllTime={setShowAllTime}
              filterType={filterType}
              setFilterType={setFilterType}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterStore={filterStore}
              setFilterStore={setFilterStore}
              onOpenTxn={openEditSheet}
            />
          )}
          {activeTab === 'msi' && (
            <MsiView
              plans={installmentPlans}
              progress={planProgress}
              categories={categories}
              onAdd={() => { setEditingPlan(null); setMsiModalOpen(true); }}
              onOpenPlan={(p) => { setEditingPlan(p); setMsiModalOpen(true); }}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountsView
              accounts={accounts}
              balances={balances}
              onAdd={() => { setEditingAccount(null); setAccountModalOpen(true); }}
              onEdit={(a) => { setEditingAccount(a); setAccountModalOpen(true); }}
            />
          )}
        </div>

        <BottomNav active={activeTab} onChange={setActiveTab} />

        <button
          onClick={() => openAddSheet('expense')}
          className="absolute right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: COLORS.accent, bottom: 82 }}
        >
          <Plus size={24} color={COLORS.bg} />
        </button>

        {sheetOpen && (
          <AddTransactionSheet
            formType={formType}
            editingId={editingId}
            form={form}
            setForm={setForm}
            accounts={accounts}
            categories={categories}
            plans={installmentPlans}
            planProgress={planProgress}
            knownStores={knownStores}
            onClose={closeSheet}
            onSave={handleSaveTransaction}
            onDelete={handleDeleteTransaction}
            onSwitchType={(t) => { setFormType(t); setForm(initialFormState(t, accounts, categories)); }}
            onCreateCategory={handleCreateCategory}
            onCreatePlan={handleCreatePlan}
          />
        )}

        {accountModalOpen && (
          <AccountFormModal
            account={editingAccount}
            canDelete={editingAccount ? !accountHasTransactions(editingAccount.id) : false}
            onClose={() => { setAccountModalOpen(false); setEditingAccount(null); }}
            onSave={handleSaveAccount}
            onDelete={() => editingAccount && handleDeleteAccount(editingAccount.id)}
          />
        )}

        {msiModalOpen && (
          <MsiPlanModal
            plan={editingPlan}
            progress={editingPlan ? planProgress[editingPlan.id] : null}
            payments={editingPlan ? transactions.filter(t => t.installmentPlanId === editingPlan.id).sort((a, b) => b.date.localeCompare(a.date)) : []}
            categories={categories.filter(c => c.type === 'expense')}
            knownStores={knownStores}
            onClose={() => { setMsiModalOpen(false); setEditingPlan(null); }}
            onSave={handleSavePlan}
            onDelete={() => editingPlan && handleDeletePlan(editingPlan.id)}
            onCreateCategory={handleCreateCategory}
          />
        )}

        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} onResetTransactions={handleResetTransactions} onOpenImport={openImportModal} />
        )}

        {importModalOpen && (
          <MonefyImportModal
            existingAccounts={accounts}
            existingCategories={categories}
            onClose={() => setImportModalOpen(false)}
            onConfirm={handleImportMonefy}
          />
        )}

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
