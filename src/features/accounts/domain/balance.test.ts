/* Dominio puro. `test/unit/helpers.test.js` ya cubre los saldos como red de
   regresión; aquí solo va lo que aquella suite no toca: `accountHasTransactions`,
   que es la condición del botón "Eliminar cuenta". */

import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../../shared/domain/types';
import { accountHasTransactions } from './balance';

const gasto = {
  id: 't1', type: 'expense', date: '2026-01-01', amount: 20, description: 'x',
  accountId: 'acc_1', categoryId: 'comida',
} as Transaction;

const transferencia = {
  id: 't2', type: 'transfer', date: '2026-01-01', amount: 50, description: 'y',
  fromAccountId: 'acc_2', toAccountId: 'acc_3', taggedAsExpense: false,
} as Transaction;

describe('accountHasTransactions', () => {
  it('detecta la cuenta de un gasto o ingreso', () => {
    expect(accountHasTransactions('acc_1', [gasto])).toBe(true);
    expect(accountHasTransactions('acc_9', [gasto])).toBe(false);
  });

  it('detecta los dos extremos de una transferencia', () => {
    expect(accountHasTransactions('acc_2', [transferencia])).toBe(true);
    expect(accountHasTransactions('acc_3', [transferencia])).toBe(true);
  });

  it('sin movimientos, ninguna cuenta está en uso', () => {
    expect(accountHasTransactions('acc_1', [])).toBe(false);
  });
});
