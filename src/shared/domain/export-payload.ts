/* El formato del "blob de datos" exportable: lo que arma un respaldo o (antes)
   un traspaso manual entre dispositivos. Vive en `shared/domain/` — no en una
   feature — porque tanto `backup` como el bootstrap de Firestore
   (`app/application/migrate-to-firestore.ts`) lo usan.

   Es dominio, no infraestructura: son transformaciones de datos, sin IO
   (salvo descomprimir, que es CPU pura vía Web Streams). */

import { base64ToBytes, gunzipBytes } from '../infrastructure/compression';
import type {
  Account, BenefitProgram, Category, DataState, InstallmentPlan, Tombstone, Transaction,
} from './types';

export const EXPORT_APP_ID = 'hilo-finanzas';
export const EXPORT_SCHEMA = 1;
export const EXPORT_TEXT_PREFIX = 'hilo1:';
export const TOMBSTONE_TTL_MS = 180 * 864e5; // 180 días — después de eso se olvida el borrado

/** Las cuatro colecciones que se funden por `id`. Las lápidas van aparte
 *  porque no se funden igual: son el registro de lo borrado. */
export const SYNC_COLLECTIONS = ['accounts', 'categories', 'transactions', 'installmentPlans'] as const;

export type SyncCollection = typeof SYNC_COLLECTIONS[number];

/** Colecciones agregadas después del schema v1: se funden y exportan igual que
 *  las de arriba, pero TOLERAN estar ausentes en un payload viejo (un export
 *  previo a la feature no las trae) en vez de exigir `Array.isArray` — mismo
 *  trato que ya recibían las lápidas antes de este tipo. */
export const OPTIONAL_SYNC_COLLECTIONS = ['benefitPrograms'] as const;

export type OptionalSyncCollection = typeof OPTIONAL_SYNC_COLLECTIONS[number];

/** Marca de tiempo con la que se decide quién gana en un merge. `updatedAt` no
 *  existe en registros previos al sync de dispositivos, de ahí la cascada. */
export const recordStamp = (r: { updatedAt?: number; createdAt?: number }): number =>
  r.updatedAt ?? r.createdAt ?? 0;

export type ExportDevice = {
  id: string;
  name: string;
};

export type ExportPayload = {
  app: string;
  schema: number;
  exportedAt: string;
  device: ExportDevice | null;
  partial: boolean;
  since: number | null;
  data: DataState;
};

/** Un payload ya validado y normalizado, listo para fundir o reemplazar. */
export type IncomingPayload = DataState & {
  exportedAt: string | null;
  device: ExportDevice | null;
  partial: boolean;
  since: number | null;
};

export type BuildOptions = {
  device?: ExportDevice | undefined;
  /** Inyectable para que un caso de uso lo haga determinista. */
  now?: number | undefined;
};

/** Siempre la foto completa (un respaldo nunca es parcial). */
export function buildExportPayload(state: DataState, { device, now }: BuildOptions = {}): ExportPayload {
  return {
    app: EXPORT_APP_ID,
    schema: EXPORT_SCHEMA,
    exportedAt: new Date(now ?? Date.now()).toISOString(),
    device: device || null,
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

/* Valida un objeto ya parseado y devuelve las 6 colecciones normalizadas más
   los metadatos del envelope. Los tres últimos (`device`, `partial`, `since`)
   faltan en exports viejos y en respaldos → null/false. `benefitPrograms`
   también falta en exports previos a la feature → `[]`, igual que
   `tombstones`. Lanza un `Error` legible si no parece un export de Hilo: el
   texto va tal cual a la UI, así que es contrato. */
export function normalizeExportPayload(obj: unknown): IncomingPayload {
  const o = obj as { app?: string; data?: Record<string, unknown>; device?: { id?: unknown; name?: unknown }; exportedAt?: unknown; partial?: unknown; since?: unknown } | null;
  if (!o || o.app !== EXPORT_APP_ID || !o.data) {
    throw new Error('Esto no parece un export de Hilo.');
  }
  const d = o.data;
  for (const key of SYNC_COLLECTIONS) {
    if (!Array.isArray(d[key])) throw new Error('El export de Hilo está incompleto o dañado.');
  }
  const dev = o.device && typeof o.device.id === 'string'
    ? { id: o.device.id, name: typeof o.device.name === 'string' ? o.device.name : '' }
    : null;
  return {
    accounts: d['accounts'] as Account[],
    categories: d['categories'] as Category[],
    transactions: d['transactions'] as Transaction[],
    installmentPlans: d['installmentPlans'] as InstallmentPlan[],
    tombstones: Array.isArray(d['tombstones']) ? (d['tombstones'] as Tombstone[]) : [],
    // Igual que `tombstones`: un export previo a la feature no la trae.
    benefitPrograms: Array.isArray(d['benefitPrograms']) ? (d['benefitPrograms'] as BenefitProgram[]) : [],
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : null,
    device: dev,
    partial: !!o.partial,
    since: Number.isFinite(o.since) ? (o.since as number) : null,
  };
}

/* Punto de entrada único para texto pegado / contenido de archivo: acepta JSON
   plano o "hilo1:<base64 gzip>". Async porque descomprimir lo es. */
export async function parseExportText(text: string): Promise<IncomingPayload> {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('No hay nada que leer.');
  if (trimmed.startsWith(EXPORT_TEXT_PREFIX)) {
    let json: string;
    try {
      json = await gunzipBytes(base64ToBytes(trimmed.slice(EXPORT_TEXT_PREFIX.length)));
    } catch {
      throw new Error('No se pudo leer el texto comprimido de Hilo.');
    }
    return normalizeExportPayload(JSON.parse(json));
  }
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw new Error('Esto no parece un export de Hilo.');
  }
  return normalizeExportPayload(obj);
}
