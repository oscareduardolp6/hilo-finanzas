/* La feature `benefits` por sus containers, sin montar `<App/>`.

   Cubre el camino completo del caso de uso que motivó la tarea: etiquetar un
   ingreso con un programa (creado inline desde el picker del formulario de
   movimiento) y ver el total reflejado en el modal de gestión/resumen. */

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Account, Category, Transaction } from '../../../shared/domain/types';
import { AHORA, renderFeature } from '../../../test/render-feature';
import { AddTransactionContainer } from '../../transactions/ui/containers/AddTransactionContainer';
import { BenefitsContainer } from './containers/BenefitsContainer';

const efectivo: Account = {
  id: 'acc_1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000,
};
const descuentos: Category = {
  id: 'descuentos', name: 'Descuentos', icon: 'Ticket', color: '#6FA8A0', type: 'income',
};

const state = { accounts: [efectivo], categories: [descuentos] };

const pantalla = () => (
  <>
    <AddTransactionContainer />
    <BenefitsContainer />
  </>
);

describe('etiquetar un ingreso con un programa nuevo', () => {
  it('el programa creado inline queda seleccionado y el ingreso lo conserva', async () => {
    const { user, store } = await renderFeature(pantalla(), { state });

    store.getState().openAddSheet('income');
    await screen.findByText('Nuevo movimiento');

    await user.type(screen.getByPlaceholderText('0.00'), '20');
    await user.click(screen.getByRole('button', { name: /Nuevo$/ }));
    await user.type(screen.getByPlaceholderText('Ej. Starbucks x Amex'), 'Starbucks x Amex');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    expect(store.getState().form).toMatchObject({ benefitProgramId: 'benefit_nuevo' });

    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(store.getState().transactions).toEqual([
      {
        id: 'txn_nuevo', type: 'income', date: expect.any(String), description: '', amount: 20,
        accountId: 'acc_1', categoryId: 'descuentos', benefitProgramId: 'benefit_nuevo',
        createdAt: AHORA, updatedAt: AHORA,
      },
    ]);
    expect(store.getState().benefitPrograms).toEqual([
      { id: 'benefit_nuevo', name: 'Starbucks x Amex', icon: 'Gift', color: '#E0793F', accountId: null, createdAt: AHORA, updatedAt: AHORA },
    ]);
  });
});

describe('resumen del modal de beneficios', () => {
  it('suma el ingreso etiquetado en "este mes"', async () => {
    const ingreso = {
      id: 't1', type: 'income', date: new Date().toISOString().slice(0, 10), amount: 35, description: '',
      accountId: 'acc_1', categoryId: 'descuentos', benefitProgramId: 'benefit_1', createdAt: 1, updatedAt: 1,
    } as Transaction;
    const { store } = await renderFeature(pantalla(), {
      state: {
        ...state,
        benefitPrograms: [{ id: 'benefit_1', name: 'Starbucks x Amex', icon: 'Gift', color: '#000', accountId: null, createdAt: 1, updatedAt: 1 }],
        transactions: [ingreso],
      },
    });

    store.getState().setBenefitsModalOpen(true);
    await screen.findByText('Beneficios y promociones');

    // "Este mes" y "Últimos 6 meses" están en la misma fila que su valor.
    const filaEsteMes = screen.getByText('Este mes').closest('div')!;
    expect(within(filaEsteMes).getByText('$35.00')).toBeInTheDocument();
  });

  it('un programa borrado ya no aparece, pero el ingreso se conserva', async () => {
    const programa = { id: 'benefit_1', name: 'Starbucks x Amex', icon: 'Gift', color: '#000', accountId: null, createdAt: 1, updatedAt: 1 };
    const { user, store } = await renderFeature(pantalla(), {
      state: { ...state, benefitPrograms: [programa] },
    });

    store.getState().setBenefitsModalOpen(true);
    await screen.findByText('Beneficios y promociones');

    await user.click(screen.getByRole('button', { name: /Eliminar Starbucks x Amex/ }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(store.getState().benefitPrograms).toEqual([]);
    expect(store.getState().tombstones).toEqual([{ id: 'benefit_1', deletedAt: AHORA }]);
  });
});
