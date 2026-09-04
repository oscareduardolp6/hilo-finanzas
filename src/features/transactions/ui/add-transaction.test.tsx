/* La feature `transactions` por su container, sin montar `<App/>`.

   Lo que se prueba aquí y no en `test/integration/transactions.test.jsx`: que la
   vertical container → slice → caso de uso → dominio está atada, y sobre todo
   que el alta inline de categorías y planes ya NO genera ids dentro del render
   — los pone el caso de uso desde `deps.idGenerator`. */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import type { Account, Category, Transaction } from '../../../shared/domain/types';
import { AHORA, renderFeature } from '../../../test/render-feature';
import { AddTransactionContainer } from './containers/AddTransactionContainer';

const efectivo: Account = {
  id: 'acc_1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B',
  initialBalance: 1000, createdAt: 1, updatedAt: 1,
};
const nu: Account = {
  id: 'acc_2', name: 'NU', type: 'credito', color: '#8D5FB0',
  initialBalance: 0, createdAt: 1, updatedAt: 1,
};

const comida: Category = {
  id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense',
};

const state = { accounts: [efectivo, nu], categories: [comida] };

/** Abre la hoja: el container solo pinta cuando `sheetOpen` está en true. */
async function abrirHoja(tipo: 'expense' | 'income' | 'transfer', extra = {}) {
  const ctx = await renderFeature(<AddTransactionContainer />, { state: { ...state, ...extra } });
  ctx.store.getState().openAddSheet(tipo);
  await screen.findByText('Nuevo movimiento');
  return ctx;
}

describe('la hoja se monta desde el store', () => {
  it('cerrada no pinta nada', async () => {
    await renderFeature(<AddTransactionContainer />, { state });
    expect(screen.queryByText('Nuevo movimiento')).not.toBeInTheDocument();
  });

  it('abrirla en blanco preselecciona la primera cuenta y categoría', async () => {
    const { store } = await abrirHoja('expense');

    expect(store.getState().form).toMatchObject({ accountId: 'acc_1', categoryId: 'comida', amount: '' });
  });

  it('editar la siembra con el movimiento y el importe como texto', async () => {
    const gasto = {
      id: 't1', type: 'expense', date: '2026-01-15', amount: 250, description: 'Súper',
      accountId: 'acc_1', categoryId: 'comida', createdAt: 1, updatedAt: 1,
    } as Transaction;
    const { store } = await renderFeature(<AddTransactionContainer />, {
      state: { ...state, transactions: [gasto] },
    });

    store.getState().openEditSheet(gasto);

    expect(await screen.findByText('Editar gasto')).toBeInTheDocument();
    expect(store.getState().form).toMatchObject({ id: 't1', amount: '250' });
  });
});

describe('alta de gasto', () => {
  it('guardar corre el caso de uso y cierra la hoja', async () => {
    const { user, store } = await abrirHoja('expense');

    await user.type(screen.getByPlaceholderText('0.00'), '250');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(store.getState().transactions).toEqual([
      {
        id: 'txn_nuevo', type: 'expense', date: expect.any(String), description: '', amount: 250,
        accountId: 'acc_1', categoryId: 'comida', store: null, installmentPlanId: null,
        size: null, brand: null, quantity: null, createdAt: AHORA, updatedAt: AHORA,
      },
    ]);
    expect(store.getState().toast).toBe('Movimiento agregado');
    expect(store.getState().sheetOpen).toBe(false);
    expect(screen.queryByText('Nuevo movimiento')).not.toBeInTheDocument();
  });

  it('sin importe el botón de guardar está deshabilitado', async () => {
    await abrirHoja('expense');
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });
});

describe('cambiar de tipo', () => {
  it('conserva el importe ya tecleado', async () => {
    const { user, store } = await abrirHoja('expense');

    await user.type(screen.getByPlaceholderText('0.00'), '480');
    await user.click(screen.getByRole('button', { name: 'Ingreso' }));

    expect(store.getState().formType).toBe('income');
    expect(store.getState().form).toMatchObject({ amount: '480' });
  });
});

describe('alta inline de categoría', () => {
  it('el id lo pone el caso de uso, no el componente, y queda seleccionada', async () => {
    const { user, store } = await abrirHoja('expense');

    await user.click(screen.getByRole('button', { name: /Nueva/ }));
    await user.type(screen.getByPlaceholderText('Nombre de la categoría'), 'Mascotas');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    // `idGenerator` de test devuelve `<prefijo>_nuevo`: si el id lo generara el
    // componente con `uid()`, sería aleatorio y este assert no existiría.
    expect(store.getState().categories).toEqual([
      comida,
      { id: 'cat_nuevo', name: 'Mascotas', icon: 'MoreHorizontal', color: '#E0793F', type: 'expense', updatedAt: AHORA },
    ]);
    expect(store.getState().toast).toBe('Categoría creada');
    // La recién creada queda elegida en el borrador.
    expect(store.getState().form).toMatchObject({ categoryId: 'cat_nuevo' });
  });
});

describe('transferencia', () => {
  it('marcarla como gasto pide categoría antes de dejar guardar', async () => {
    const { user, store } = await abrirHoja('transfer');

    await user.type(screen.getByPlaceholderText('0.00'), '500');
    // Con origen y destino distintos ya es válida...
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Marcar como gasto/ }));

    // ...pero al marcarla como gasto necesita categoría, y el borrador la trae vacía.
    expect(store.getState().form).toMatchObject({ taggedAsExpense: true, categoryId: '' });
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('guardada sin marcar, no arrastra categoría ni tienda', async () => {
    const { user, store } = await abrirHoja('transfer');

    await user.type(screen.getByPlaceholderText('0.00'), '500');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(store.getState().transactions[0]).toMatchObject({
      type: 'transfer', fromAccountId: 'acc_1', toAccountId: 'acc_2',
      taggedAsExpense: false, categoryId: null, store: null,
    });
  });
});

describe('borrado', () => {
  it('pide confirmación y deja lápida', async () => {
    const gasto = {
      id: 't1', type: 'expense', date: '2026-01-15', amount: 250, description: 'Súper',
      accountId: 'acc_1', categoryId: 'comida', createdAt: 1, updatedAt: 1,
    } as Transaction;
    const { user, store } = await renderFeature(<AddTransactionContainer />, {
      state: { ...state, transactions: [gasto] },
    });

    store.getState().openEditSheet(gasto);
    await screen.findByText('Editar gasto');
    await user.click(screen.getByRole('button', { name: 'Eliminar movimiento' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(store.getState().transactions).toEqual([]);
    expect(store.getState().tombstones).toEqual([{ id: 't1', deletedAt: AHORA }]);
    expect(store.getState().sheetOpen).toBe(false);
  });
});
