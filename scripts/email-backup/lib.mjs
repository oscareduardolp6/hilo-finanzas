/* Lógica pura del respaldo por correo: leer el documento de Firestore, armar
   el respaldo y resumirlo. Sin red ni secretos, para poder probarla sola
   (ver `lib.test.mjs`). Lo que habla con Firestore y Gmail está en `index.mjs`.

   El respaldo tiene el mismo formato que exporta la app (`buildExportPayload`
   en src/shared/domain/export-payload.ts), así que se restaura tal cual desde
   Ajustes → Respaldo. */

import { gunzipSync, gzipSync } from 'node:zlib';

export const EXPORT_APP_ID = 'hilo-finanzas';
export const EXPORT_SCHEMA = 1;
export const EXPORT_TEXT_PREFIX = 'hilo1:';
export const TIME_ZONE = 'America/Mexico_City';
/** Si el movimiento más reciente es más viejo que esto, el correo avisa. */
export const STALE_AFTER_DAYS = 7;

/** El documento `users/{uid}` tal como lo guarda `firestoreStateRepository`:
 *  `{ blob }` con el JSON comprimido en gzip, o el objeto plano de antes de
 *  la compresión. */
export function decodeStateDocument(raw) {
  if (!raw) throw new Error('El documento del usuario no existe en Firestore.');
  const state = raw.blob ? JSON.parse(gunzipSync(Buffer.from(raw.blob)).toString('utf8')) : raw;
  if (!Array.isArray(state.accounts) || !Array.isArray(state.transactions)) {
    throw new Error('El documento de Firestore no tiene la forma esperada.');
  }
  return state;
}

/** Igual que `buildExportPayload` de la app. */
export function buildBackupPayload(state, now) {
  return {
    app: EXPORT_APP_ID,
    schema: EXPORT_SCHEMA,
    exportedAt: now.toISOString(),
    device: { id: 'github-actions', name: 'Respaldo automático por correo' },
    partial: false,
    since: null,
    data: {
      accounts: state.accounts || [],
      categories: state.categories || [],
      transactions: state.transactions || [],
      installmentPlans: state.installmentPlans || [],
      tombstones: state.tombstones || [],
      benefitPrograms: state.benefitPrograms || [],
    },
  };
}

/** El texto "hilo1:<base64 gzip>" que `parseExportText` ya sabe leer. Pesa
 *  ~10 veces menos que el JSON plano, para no llenar el correo. */
export function encodeBackup(payload) {
  return EXPORT_TEXT_PREFIX + gzipSync(JSON.stringify(payload)).toString('base64');
}

/** `YYYY-MM-DD` de `date` en la hora de México. */
export function localDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** Lo que dice el correo: cuántos movimientos hay, los de los últimos meses y
 *  la fecha del más reciente. Sirve para notar una pérdida de datos a tiempo. */
export function summarize(state, now) {
  const transactions = state.transactions || [];
  const today = localDay(now);
  const months = lastMonths(today, 3);
  const perMonth = Object.fromEntries(months.map((m) => [m, 0]));
  let latest = null;
  for (const t of transactions) {
    const date = typeof t.date === 'string' ? t.date.slice(0, 10) : null;
    if (!date) continue;
    if (date.slice(0, 7) in perMonth) perMonth[date.slice(0, 7)] += 1;
    if (date <= today && (latest === null || date > latest)) latest = date;
  }
  const daysSinceLatest = latest === null ? null : daysBetween(latest, today);
  return {
    today,
    totalTransactions: transactions.length,
    accounts: (state.accounts || []).length,
    perMonth,
    latest,
    stale: daysSinceLatest === null || daysSinceLatest > STALE_AFTER_DAYS,
    daysSinceLatest,
  };
}

export function emailSubject(summary) {
  const warn = summary.stale ? '⚠️ ' : '';
  return `${warn}Respaldo de Hilo — ${summary.today} (${formatCount(summary.totalTransactions)} movimientos)`;
}

export function emailBody(summary, fileName) {
  const lines = [];
  if (summary.stale) {
    lines.push(
      summary.latest
        ? `⚠️ El movimiento más reciente es del ${summary.latest} (hace ${summary.daysSinceLatest} días). Si registraste algo después, revisa la app: tus datos podrían haberse perdido. Guarda un respaldo anterior a este.`
        : '⚠️ El respaldo no tiene movimientos. Si tenías datos, revisa la app y guarda un respaldo anterior a este.',
      '',
    );
  }
  lines.push(
    `Movimientos: ${formatCount(summary.totalTransactions)}`,
    `Cuentas: ${summary.accounts}`,
    `Movimiento más reciente: ${summary.latest ?? '—'}`,
    '',
    'Movimientos por mes:',
    ...Object.entries(summary.perMonth).map(([month, n]) => `  ${month}: ${formatCount(n)}`),
    '',
    `Para restaurarlo: descarga ${fileName}, abre Hilo → Ajustes → Respaldo → Restaurar desde archivo y elige el archivo.`,
    'Restaurar reemplaza TODOS los datos actuales por los del respaldo.',
  );
  return lines.join('\n');
}

function lastMonths(today, count) {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const out = [];
  for (let i = 0; i < count; i++) {
    out.unshift(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

function formatCount(n) {
  return new Intl.NumberFormat('es-MX').format(n);
}
