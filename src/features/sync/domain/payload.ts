/* El formato del "blob de datos": lo que viaja entre dispositivos, ya sea como
   archivo, como texto comprimido o como QR. No hay servidor — el usuario mueve
   el archivo/texto/QR a mano. Ver agents/plans/desktop-mobile-sync.md.

   El mismo formato sirve para sincronizar (merge) y para respaldar (replace),
   así que `backup` importa de aquí. Es dominio, no infraestructura: son
   transformaciones de datos, sin IO. */

import { base64ToBytes, gunzipBytes } from '../../../shared/infrastructure/compression';
import type {
  Account, BenefitProgram, Category, DataState, InstallmentPlan, Tombstone, Transaction,
} from '../../../shared/domain/types';

export const EXPORT_APP_ID = 'hilo-finanzas';
export const EXPORT_SCHEMA = 1;
export const EXPORT_TEXT_PREFIX = 'hilo1:';
export const QR_BYTE_LIMIT = 2900;          // capacidad práctica de un QR byte-mode (v40, ECC L)
export const TOMBSTONE_TTL_MS = 180 * 864e5; // 180 días — después de eso se olvida el borrado
export const SYNC_SKEW_MARGIN_MS = 5 * 60 * 1000; // margen anti-desfase de reloj al calcular un delta

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
 *  existe en registros previos al sync, de ahí la cascada. */
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
  /** Epoch: con él el payload es un DELTA. Sin él, la foto completa. */
  since?: number | undefined;
  /** Inyectable para que un caso de uso lo haga determinista. */
  now?: number | undefined;
};

/* Sin opts es la foto completa (sync completo / respaldo). Con `since` es un
   DELTA: solo registros y tombstones tocados después de ese punto — el merge
   del receptor los funde por `id` igual, porque un registro AUSENTE nunca es un
   borrado (eso solo viaja como lápida). `device` identifica al emisor para que
   el receptor lleve el registro de hasta dónde recibió de él.
   Ver agents/plans/sync-incremental.md. */
export function buildExportPayload(state: DataState, { device, since, now }: BuildOptions = {}): ExportPayload {
  const partial = Number.isFinite(since);
  // El margen absorbe el desfase entre los relojes de los dos dispositivos:
  // mandar de más es inocuo, mandar de menos pierde un registro para siempre.
  const cutoff = partial ? (since as number) - SYNC_SKEW_MARGIN_MS : -Infinity;
  const pick = <T extends { updatedAt?: number; createdAt?: number }>(list: T[] | undefined): T[] =>
    (partial ? (list || []).filter((r) => recordStamp(r) > cutoff) : (list || []));
  return {
    app: EXPORT_APP_ID,
    schema: EXPORT_SCHEMA,
    exportedAt: new Date(now ?? Date.now()).toISOString(),
    device: device || null,
    partial,
    since: partial ? (since as number) : null,
    data: {
      accounts: pick<Account>(state.accounts),
      categories: pick<Category>(state.categories),
      transactions: pick<Transaction>(state.transactions),
      installmentPlans: pick<InstallmentPlan>(state.installmentPlans),
      tombstones: partial
        ? (state.tombstones || []).filter((t) => (t.deletedAt || 0) > cutoff)
        : (state.tombstones || []),
      benefitPrograms: pick<BenefitProgram>(state.benefitPrograms),
    },
  };
}

/* Valida un objeto ya parseado y devuelve las 6 colecciones normalizadas más
   los metadatos del envelope. Los tres últimos (`device`, `partial`, `since`)
   faltan en exports viejos y en respaldos → null/false, y ni el merge ni el
   replace los miran. `benefitPrograms` también falta en exports previos a la
   feature → `[]`, igual que `tombstones`. Lanza un `Error` legible si no
   parece un export de Hilo: el texto va tal cual a la UI, así que es contrato. */
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

/** Para el QR: los bytes escaneados son el JSON comprimido con gzip. */
export async function parseExportBytes(bytes: Uint8Array): Promise<IncomingPayload> {
  let json: string;
  try {
    json = await gunzipBytes(bytes);
  } catch {
    throw new Error('El QR no contiene datos de Hilo legibles.');
  }
  return normalizeExportPayload(JSON.parse(json));
}

/** Cuántos registros lleva un payload. Es lo que la UI muestra como "N
 *  registros" al preparar un delta. */
export function countPayloadRecords(payload: ExportPayload): number {
  return SYNC_COLLECTIONS.reduce((n, k) => n + payload.data[k].length, 0)
    + payload.data.tombstones.length
    + payload.data.benefitPrograms.length;
}
