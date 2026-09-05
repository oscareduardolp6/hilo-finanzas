/* El merge: cómo se funden dos datasets sin servidor que arbitre.

   Dos reglas, y de ellas sale todo lo demás:

   1. Se funde **por `id`**, y gana el `recordStamp` mayor (empate → el
      entrante). Last-write-wins, sin vectores de versión: para un usuario con
      sus propios dispositivos es suficiente y es explicable.
   2. La AUSENCIA de un registro nunca significa borrado — si lo significara, un
      delta borraría todo lo que no lleva. Un borrado solo viaja como lápida. */

import type { DataState, Tombstone } from '../../../shared/domain/types';
import { SYNC_COLLECTIONS, TOMBSTONE_TTL_MS, recordStamp } from './payload';

export type MergeStats = {
  added: number;
  updated: number;
  removed: number;
};

export type MergeResult = DataState & {
  stats: MergeStats;
};

type Record_ = { id: string; updatedAt?: number; createdAt?: number };

/** Funde dos listas por `id` y luego descarta lo que tenga una lápida posterior
 *  a su última edición. El orden importa: un registro que llega ya borrado se
 *  añade y se quita en el mismo paso, y por eso cuenta en `added` y en
 *  `removed` — refleja lo que de verdad pasó. */
export function mergeCollection<T extends Record_>(
  currentList: T[] | undefined,
  incomingList: T[] | undefined,
  tombstoneMap: Map<string, number>,
): { list: T[]; added: number; updated: number; removed: number } {
  const map = new Map((currentList || []).map((r) => [r.id, r]));
  let added = 0;
  let updated = 0;
  for (const inc of incomingList || []) {
    const cur = map.get(inc.id);
    if (!cur) {
      map.set(inc.id, inc);
      added++;
    } else if (recordStamp(inc) >= recordStamp(cur)) {
      map.set(inc.id, inc);
      // Solo cuenta como actualización si de verdad es más nuevo: un empate
      // reemplaza (para que el entrante mande) pero no es un cambio.
      if (recordStamp(inc) > recordStamp(cur)) updated++;
    }
  }
  let removed = 0;
  const list: T[] = [];
  for (const r of map.values()) {
    const deletedAt = tombstoneMap.get(r.id);
    if (deletedAt != null && deletedAt >= recordStamp(r)) {
      removed++;
      continue;
    }
    list.push(r);
  }
  return { list, added, updated, removed };
}

/** Une dos listas de lápidas y poda las de más de 180 días. La poda es lo que
 *  evita que el registro de borrados crezca para siempre; el precio es que un
 *  dispositivo que estuvo apagado más de ese tiempo puede resucitar un
 *  registro, y se acepta a sabiendas. */
export function mergeTombstones(
  a: Tombstone[] | undefined,
  b: Tombstone[] | undefined,
  now: number = Date.now(),
): Tombstone[] {
  const cutoff = now - TOMBSTONE_TTL_MS;
  const map = new Map<string, number>();
  for (const t of [...(a || []), ...(b || [])]) {
    if (!t || !t.id || typeof t.deletedAt !== 'number') continue;
    if (t.deletedAt < cutoff) continue;
    const prev = map.get(t.id);
    if (prev == null || t.deletedAt > prev) map.set(t.id, t.deletedAt);
  }
  return [...map.entries()].map(([id, deletedAt]) => ({ id, deletedAt }));
}

/** Merge de sincronización: une lápidas y aplica el mapa a las 4 colecciones. */
export function mergeDataState(
  current: DataState,
  incoming: Partial<DataState>,
  now: number = Date.now(),
): MergeResult {
  const tombstones = mergeTombstones(current.tombstones, incoming.tombstones, now);
  const tombstoneMap = new Map(tombstones.map((t) => [t.id, t.deletedAt]));
  const stats: MergeStats = { added: 0, updated: 0, removed: 0 };
  const out = { tombstones } as MergeResult;
  for (const key of SYNC_COLLECTIONS) {
    const res = mergeCollection(current[key] as Record_[], incoming[key] as Record_[] | undefined, tombstoneMap);
    (out as Record<string, unknown>)[key] = res.list;
    stats.added += res.added;
    stats.updated += res.updated;
    stats.removed += res.removed;
  }
  out.stats = stats;
  return out;
}
