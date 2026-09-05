/* Restaurar un respaldo: reemplazar todo con la foto del payload.

   Es la otra forma de aplicar un payload entrante, y la opuesta al merge de
   `sync`: aquí lo que había se pierde a propósito. Por eso `BackupModal` pide
   confirmación y `SyncModal` no.

   La feature `backup` se migra completa en el paso 9; esto llega antes porque
   el bloque de export/sync del legacy se vació entero en el paso 8, y dejar
   sola aquí la única función de respaldo habría sido peor. */

import type { DataState } from '../../../shared/domain/types';

export function replaceDataState(incoming: Partial<DataState>): DataState {
  return {
    accounts: incoming.accounts || [],
    categories: incoming.categories || [],
    transactions: incoming.transactions || [],
    installmentPlans: incoming.installmentPlans || [],
    tombstones: Array.isArray(incoming.tombstones) ? incoming.tombstones : [],
  };
}
