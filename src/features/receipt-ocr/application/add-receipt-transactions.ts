/* Agregar lo que el ticket dejó confirmado. Era un handler de 45 líneas dentro
   de `AppBody` que llamaba a `uid()` y `Date.now()` y hacía tres `setState`.

   `ReaderIO`: necesita ids y reloj, nada más. La parte interesante —qué
   movimiento es cada renglón— vive en `domain/to-transactions.ts`; aquí solo se
   resuelve la categoría de descuentos, que puede haber que crear. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import { isoFromEpoch } from '../../../shared/domain/dates';
import type { Category, Transaction } from '../../../shared/domain/types';
import {
  DISCOUNT_CATEGORY, buildReceiptTransactions, findDiscountCategory, includedDiscounts,
} from '../domain/to-transactions';
import type { ReceiptPayload } from '../domain/to-transactions';

export type AddReceiptResult = {
  categories: Category[];
  transactions: Transaction[];
  toast: string;
};

export const addReceiptTransactions =
  (
    categories: Category[],
    transactions: Transaction[],
    payload: ReceiptPayload,
  ): ReaderIO<Deps, AddReceiptResult> =>
  (deps) =>
  () => {
    const now = deps.clock();

    /* La categoría "Descuentos" es semilla desde hace tiempo, pero hay perfiles
       anteriores: si falta, se crea aquí. Solo cuando hay algún descuento con
       monto — crearla para no usarla sería ensuciar la lista. */
    const hayDescuentos = includedDiscounts(payload).length > 0;
    const existente = hayDescuentos ? findDiscountCategory(categories) : undefined;
    const creada = hayDescuentos && !existente
      ? { ...DISCOUNT_CATEGORY, id: deps.idGenerator('cat'), createdAt: now, updatedAt: now }
      : null;
    const discountCategoryId = existente ? existente.id : (creada ? creada.id : null);

    const built = buildReceiptTransactions(payload, discountCategoryId, isoFromEpoch(now));

    if (!built.length) {
      // Nada que agregar: ni siquiera la categoría nueva, que solo existe si
      // había un descuento con monto (y entonces habría al menos un movimiento).
      return { categories, transactions, toast: 'No hay movimientos por agregar' };
    }

    return {
      categories: creada ? [...categories, creada] : categories,
      transactions: [
        ...transactions,
        ...built.map((t) => ({ ...t, id: deps.idGenerator('txn'), createdAt: now, updatedAt: now } as Transaction)),
      ],
      toast: `${built.length} ${built.length === 1 ? 'movimiento agregado' : 'movimientos agregados'} desde el ticket`,
    };
  };
