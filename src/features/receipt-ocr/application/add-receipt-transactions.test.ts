/* El caso de uso que convierte un ticket revisado en movimientos. Lo que más
   importa aquí es la regla que hace que las cuentas cuadren: los artículos
   entran a precio de lista y el descuento entra como INGRESO, de modo que
   `subtotal − descuento` es lo que realmente salió del bolsillo. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { Category, Transaction } from '../../../shared/domain/types';
import type { ReceiptPayload } from '../domain/to-transactions';
import { addReceiptTransactions } from './add-receipt-transactions';

const AHORA = new Date(2026, 8, 5, 12, 0, 0).getTime();
let n = 0;
const deps = createDeps({ clock: () => AHORA, idGenerator: (p) => `${p}_${++n}` });

const comida: Category = { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#111', type: 'expense' };
const descuentos: Category = { id: 'desc', name: 'Descuentos', icon: 'Ticket', color: '#6FA8A0', type: 'income' };

const payload = (over: Partial<ReceiptPayload> = {}): ReceiptPayload => ({
  date: '2026-09-01',
  store: 'Soriana',
  originAccountId: 'tarjeta',
  rows: [{ description: 'Leche', amount: 45.5, categoryId: 'comida', accountId: 'a1', quantity: '2', viaTransfer: false }],
  discounts: [],
  ...over,
});

const run = (categories: Category[], p: ReceiptPayload, current: Transaction[] = []) =>
  runRIO(addReceiptTransactions(categories, current, p), deps);

describe('addReceiptTransactions', () => {
  it('un renglón simple es un gasto, con la tienda y la cantidad del ticket', () => {
    n = 0;
    const next = run([comida], payload());

    expect(next.transactions).toHaveLength(1);
    expect(next.transactions[0]).toMatchObject({
      type: 'expense', accountId: 'a1', categoryId: 'comida', amount: 45.5,
      date: '2026-09-01', store: 'Soriana', quantity: '2', description: 'Leche',
      createdAt: AHORA, updatedAt: AHORA,
    });
    expect(next.toast).toBe('1 movimiento agregado desde el ticket');
  });

  it('en modo transferencia el renglón sale de la cuenta de origen y va marcado como gasto', () => {
    n = 0;
    const next = run([comida], payload({
      rows: [{ description: 'Leche', amount: 45.5, categoryId: 'comida', accountId: 'tdc', quantity: '', viaTransfer: true }],
    }));

    expect(next.transactions[0]).toMatchObject({
      type: 'transfer', fromAccountId: 'tarjeta', toAccountId: 'tdc',
      taggedAsExpense: true, categoryId: 'comida',
    });
  });

  it('el descuento entra como ingreso en "Descuentos", que es lo que hace que cuadre', () => {
    n = 0;
    const next = run([comida, descuentos], payload({
      discounts: [{ label: 'Ahorro total', amount: 5.5, accountId: 'a1' }],
    }));

    expect(next.transactions).toHaveLength(2);
    expect(next.transactions[1]).toMatchObject({
      type: 'income', categoryId: 'desc', amount: 5.5, description: 'Ahorro total', accountId: 'a1',
    });
    // 45.50 de artículos − 5.50 de descuento = 40 que salieron de verdad.
    expect(next.transactions[0]!.amount - next.transactions[1]!.amount).toBe(40);
  });

  it('en un perfil sin la categoría "Descuentos" la re-crea', () => {
    n = 0;
    const next = run([comida], payload({
      discounts: [{ label: 'Ahorro', amount: 5, accountId: 'a1' }],
    }));

    const creada = next.categories.find(c => c.name === 'Descuentos');
    expect(creada).toMatchObject({ type: 'income', icon: 'Ticket', createdAt: AHORA });
    expect(next.transactions[1]!.categoryId).toBe(creada!.id);
  });

  it('sin descuentos no crea ninguna categoría', () => {
    n = 0;
    const categories = [comida];

    expect(run(categories, payload()).categories).toBe(categories);
  });

  it('un renglón en cero no es un movimiento', () => {
    n = 0;
    const next = run([comida], payload({
      rows: [{ description: 'Vacío', amount: 0, categoryId: 'comida', accountId: 'a1', quantity: '', viaTransfer: false }],
    }));

    expect(next.transactions).toEqual([]);
    expect(next.toast).toBe('No hay movimientos por agregar');
  });

  it('agrega a lo que ya había, sin pisarlo', () => {
    n = 0;
    const previo = { id: 'viejo', type: 'expense', date: '2026-01-01', amount: 1, description: 'Previo', accountId: 'a1', categoryId: 'comida' } as Transaction;

    const next = run([comida], payload(), [previo]);

    expect(next.transactions[0]).toBe(previo);
    expect(next.transactions).toHaveLength(2);
  });
});
