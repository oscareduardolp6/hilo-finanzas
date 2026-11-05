/* Caso de uso: agregar un renglón o un descuento al desglose del borrador.

   Existe solo para que el id del renglón lo ponga `deps.idGenerator` y no el
   render — el mismo motivo por el que `createCategory` es un caso de uso. Si el
   borrador aún no tenía desglose, lo abre. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import { emptyBreakdownDraft, newDiscountDraft, newItemDraft } from '../domain/breakdown';
import type { TransactionFormDraft } from '../domain/form';

export type BreakdownLineKind = 'item' | 'discount';

export const appendBreakdownLine =
  (form: TransactionFormDraft, kind: BreakdownLineKind): ReaderIO<Deps, TransactionFormDraft> =>
  (deps) =>
  () => {
    const b = form.breakdown ?? emptyBreakdownDraft();
    return {
      ...form,
      breakdown: kind === 'item'
        ? { ...b, items: [...b.items, newItemDraft(deps.idGenerator('bitem'))] }
        : { ...b, discounts: [...b.discounts, newDiscountDraft(deps.idGenerator('bdisc'))] },
    };
  };
