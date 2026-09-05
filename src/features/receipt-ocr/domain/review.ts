/* Lo que la hoja de revisión deriva de lo que el usuario lleva editado: qué
   suma, qué cuentas participan, si cuadra con el ticket y si ya se puede
   guardar.

   Estaba todo inline en `ReceiptScanModal`, entre el JSX. Aquí es una función
   pura de once líneas con nombre, y el componente pasa a recibir el resultado
   ya hecho — que es la regla de renderizado vs. lógica. */

import type { ReceiptDiscount, ReceiptRow } from './draft';

/** Un renglón sin cuenta propia va a la principal del ticket. */
export const rowAccountId = (row: ReceiptRow, primaryAccountId: string): string =>
  row.accountId || primaryAccountId;

export type ReviewInput = {
  rows: ReceiptRow[];
  discounts: ReceiptDiscount[];
  primaryAccountId: string;
  originAccountId: string;
  /** Por cuenta y solo para este ticket: `true` = registrar como transferencia
   *  marcada como gasto en vez de gasto simple. */
  accountModes: Record<string, boolean | undefined>;
  /** El total impreso en el ticket, para contrastar. */
  ticketTotal: number;
};

export type ReviewTotals = {
  includedRows: ReceiptRow[];
  includedDiscounts: ReceiptDiscount[];
  /** Las cuentas que este ticket va a tocar, en orden de aparición. */
  usedAccountIds: string[];
  anyTransfer: boolean;
  sumRows: number;
  sumDiscounts: number;
  net: number;
  /** La suma no cuadra con el total impreso: aviso, no bloqueo. */
  mismatch: boolean;
  totalCount: number;
  canSave: boolean;
};

const toNumber = (v: string | number): number => parseFloat(String(v)) || 0;

export function computeReviewTotals(
  { rows, discounts, primaryAccountId, originAccountId, accountModes, ticketTotal }: ReviewInput,
): ReviewTotals {
  const includedRows = rows.filter(r => r.included);
  const includedDiscounts = discounts.filter(d => d.included);
  const usedAccountIds = Array.from(new Set(includedRows.map(r => rowAccountId(r, primaryAccountId))));
  const anyTransfer = usedAccountIds.some(id => !!accountModes[id]);

  const sumRows = includedRows.reduce((s, r) => s + toNumber(r.amount), 0);
  const sumDiscounts = includedDiscounts.reduce((s, d) => s + toNumber(d.amount), 0);
  const net = sumRows - sumDiscounts;
  const totalCount = includedRows.length + includedDiscounts.length;

  return {
    includedRows,
    includedDiscounts,
    usedAccountIds,
    anyTransfer,
    sumRows,
    sumDiscounts,
    net,
    // Medio peso de margen: los redondeos del ticket no son un error que valga
    // la pena señalar.
    mismatch: ticketTotal > 0 && Math.abs(net - ticketTotal) > 0.5,
    totalCount,
    // Sin cuenta de origen no se puede representar una transferencia, así que
    // solo se exige cuando alguna cuenta está en ese modo.
    canSave: totalCount > 0 && !!primaryAccountId && (!anyTransfer || !!originAccountId),
  };
}
