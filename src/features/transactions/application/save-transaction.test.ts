/* Los casos de uso de movimientos, con `Deps` inyectadas: reloj e ids fijos, así
   que el resultado se compara entero. Sin React, sin IndexedDB, sin mocks. */

import { describe, it, expect } from 'vitest';
import { createDeps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { Transaction } from '../../../shared/domain/types';
import { deleteTransaction, resetTransactions } from './delete-transaction';
import { saveTransaction } from './save-transaction';

/** 2026-09-04 en hora local: el "hoy" que el caso de uso deriva del reloj. */
const AHORA = new Date(2026, 8, 4, 12, 0, 0).getTime();

const deps = createDeps({ clock: () => AHORA, idGenerator: () => 'txn_fijo' });

const gasto = {
  id: 't1', type: 'expense', date: '2026-01-15', amount: 100, description: 'Súper',
  accountId: 'a1', categoryId: 'comida', store: null, installmentPlanId: null,
  size: null, brand: null, quantity: null, createdAt: 1, updatedAt: 1,
} as Transaction;

const base = { date: '2026-01-15', description: 'Tacos', amount: '250' };

describe('saveTransaction', () => {
  it('sin editingId lo agrega al final, con id y marcas de tiempo', () => {
    const { transactions, toast } = runRIO(
      saveTransaction(
        { transactions: [gasto], formType: 'income', editingId: null },
        { ...base, accountId: 'a1', categoryId: 'sueldo' },
      ),
      deps,
    );

    expect(toast).toBe('Movimiento agregado');
    expect(transactions).toHaveLength(2);
    expect(transactions[1]).toEqual({
      id: 'txn_fijo', type: 'income', date: '2026-01-15', description: 'Tacos', amount: 250,
      accountId: 'a1', categoryId: 'sueldo', createdAt: AHORA, updatedAt: AHORA,
    });
  });

  it('con editingId edita ese movimiento y conserva su createdAt', () => {
    const { transactions, toast } = runRIO(
      saveTransaction(
        { transactions: [gasto], formType: 'expense', editingId: 't1' },
        { ...base, amount: '999', accountId: 'a1', categoryId: 'comida' },
      ),
      deps,
    );

    expect(toast).toBe('Movimiento actualizado');
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ id: 't1', amount: 999, createdAt: 1, updatedAt: AHORA });
  });

  it('sin fecha en el borrador usa el día del reloj inyectado, no el real', () => {
    const { transactions } = runRIO(
      saveTransaction(
        { transactions: [], formType: 'expense', editingId: null },
        { date: '', description: '', amount: '10', accountId: 'a1', categoryId: 'c1' },
      ),
      deps,
    );

    expect(transactions[0]?.date).toBe('2026-09-04');
  });

  it('no muta la colección que recibe', () => {
    const original = [gasto];
    runRIO(
      saveTransaction({ transactions: original, formType: 'expense', editingId: null }, { ...base }),
      deps,
    );
    expect(original).toEqual([gasto]);
  });

  it('construirlo no toca el reloj: solo correrlo', () => {
    let usos = 0;
    const espia = createDeps({ clock: () => { usos += 1; return AHORA; }, idGenerator: () => 'x' });

    const useCase = saveTransaction({ transactions: [], formType: 'expense', editingId: null }, { ...base });
    expect(usos).toBe(0);

    runRIO(useCase, espia);
    expect(usos).toBe(1);
  });
});

describe('deleteTransaction', () => {
  it('lo quita y deja una lápida', () => {
    const { transactions, tombstones, toast } = runRIO(
      deleteTransaction({ transactions: [gasto], tombstones: [] }, 't1'),
      deps,
    );

    expect(toast).toBe('Movimiento eliminado');
    expect(transactions).toEqual([]);
    expect(tombstones).toEqual([{ id: 't1', deletedAt: AHORA }]);
  });
});

describe('resetTransactions', () => {
  it('vacía la colección y deja una lápida por cada movimiento', () => {
    const otro = { ...gasto, id: 't2' } as Transaction;

    const { transactions, tombstones, toast } = runRIO(
      resetTransactions({ transactions: [gasto, otro], tombstones: [{ id: 'viejo', deletedAt: 1 }] }),
      deps,
    );

    expect(toast).toBe('Movimientos borrados');
    expect(transactions).toEqual([]);
    // Las lápidas previas se conservan: son las que propagan borrados anteriores.
    expect(tombstones).toEqual([
      { id: 'viejo', deletedAt: 1 },
      { id: 't1', deletedAt: AHORA },
      { id: 't2', deletedAt: AHORA },
    ]);
  });
});
