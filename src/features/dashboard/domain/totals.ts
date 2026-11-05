/* Los totales del mes que pinta Inicio. Funciones puras: reciben los
   movimientos del periodo (`computePeriodTransactions`, de `transactions`) y
   devuelven números o una lista, sin tocar el store ni React. */

import { COLORS } from '../../../shared/design/tokens';
import type { Category, Transaction } from '../../../shared/domain/types';
import { computeCategoryPortions, getBreakdown } from '../../transactions/domain/breakdown';

/** Una porción de la dona. `id` es el de la categoría. */
export type CategoryTotal = {
  id: string;
  total: number;
  name: string;
  color: string;
  icon: string;
};

export function computeTotalIncome(periodTransactions: Transaction[]): number {
  return periodTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}

/** Gastos **más** transferencias marcadas como gasto. Es el concepto central
 *  del dominio: pagar la tarjeta suma al gasto por categoría sin volver a
 *  restar del saldo total (el dinero ya salió como transferencia). */
export function computeTotalExpense(periodTransactions: Transaction[]): number {
  return periodTransactions.reduce((s, t) => {
    if (t.type === 'expense') return s + t.amount;
    if (t.type === 'transfer' && t.taggedAsExpense) return s + t.amount;
    return s;
  }, 0);
}

/* El color de una categoría que ya no existe entra por parámetro para no
   clavar un token de diseño en medio del cálculo. El default reproduce el de
   antes del refactor, porque `test/unit/domain.test.js` llama con dos
   argumentos: la firma de dos sigue siendo la de siempre.

   Que el default siga alcanzando `COLORS` deja la fuga a medio cerrar, y es
   deliberado: cerrarla del todo obliga a devolver `color: null` y a decidir el
   fallback en los cuatro puntos de la dona que lo pintan, o a duplicar el hex.
   Ninguna de las dos vale dentro de un refactor cuyo contrato es no cambiar
   comportamiento. */

export function computeCategoryTotals(
  periodTransactions: Transaction[],
  categories: Category[],
  unknownColor: string = COLORS.textMuted,
): CategoryTotal[] {
  const map: Record<string, number> = {};
  // Las categorías que tocó algún desglose: solo esas pueden quedar en cero o
  // negativas (un descuento asignado a otra categoría), y una porción así no
  // tiene sentido en la dona.
  const fromBreakdown = new Set<string>();
  for (const t of periodTransactions) {
    // Sin desglose, una sola porción: la categoría del movimiento por su monto.
    const hasBreakdown = !!getBreakdown(t);
    for (const p of computeCategoryPortions(t)) {
      // Una transferencia marcada como gasto pero sin categoría no cuenta: no
      // hay dónde sumarla.
      if (!p.categoryId) continue;
      map[p.categoryId] = (map[p.categoryId] || 0) + p.amount;
      if (hasBreakdown) fromBreakdown.add(p.categoryId);
    }
  }
  return Object.entries(map).filter(([id, total]) => !(fromBreakdown.has(id) && total < 0.005)).map(([id, total]) => {
    const cat = categories.find(c => c.id === id);
    return {
      id,
      total,
      name: cat ? cat.name : 'Otros',
      color: cat ? cat.color : unknownColor,
      icon: cat ? cat.icon : 'MoreHorizontal',
    };
  }).sort((a, b) => b.total - a.total);
}
