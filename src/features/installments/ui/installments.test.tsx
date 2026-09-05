/* La feature `installments` por sus containers, sin montar `<App/>`. */

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { Category, InstallmentPlan, Transaction } from '../../../shared/domain/types';
import { AHORA, renderFeature } from '../../../test/render-feature';
import { MsiContainer } from './containers/MsiContainer';
import { MsiPlanFormContainer } from './containers/MsiPlanFormContainer';

const compras: Category = {
  id: 'compras', name: 'Compras', icon: 'ShoppingBag', color: '#3F9C8B', type: 'expense',
};

const audifonos: InstallmentPlan = {
  id: 'msi_1', description: 'Audífonos', store: 'Walmart', totalAmount: 900,
  installmentsCount: 6, categoryId: 'compras', startDate: '2026-01-01',
  createdAt: 10, updatedAt: 10,
};

const abono = (id: string, amount: number, date = '2026-01-15') => ({
  id, type: 'transfer', date, amount, description: 'Pago',
  fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: true,
  categoryId: 'compras', installmentPlanId: 'msi_1', createdAt: 1, updatedAt: 1,
} as Transaction);

const pantalla = (desktop?: boolean) => (
  <>
    <MsiContainer desktop={desktop} />
    <MsiPlanFormContainer desktop={desktop} />
  </>
);

const base = { categories: [compras], installmentPlans: [audifonos] };

describe('lista de planes', () => {
  it('sin planes invita a crear el primero', async () => {
    await renderFeature(pantalla(), { state: { categories: [compras] } });
    expect(screen.getByText(/Aún no registras compras a meses/)).toBeInTheDocument();
  });

  it('un abono parcial avanza el progreso y el plan sigue activo', async () => {
    await renderFeature(pantalla(), { state: { ...base, transactions: [abono('t1', 225)] } });

    const tarjeta = screen.getByRole('button', { name: /Audífonos/ });
    expect(within(tarjeta).getByText('$225.00 de $900.00')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Quedan $675.00')).toBeInTheDocument();
    // 225 / (900/6) = 1.5 mensualidades
    expect(within(tarjeta).getByText('1.5/6')).toBeInTheDocument();
    expect(screen.queryByText('Ya pagados')).not.toBeInTheDocument();
  });

  it('al cubrir el total pasa a "Ya pagados"', async () => {
    await renderFeature(pantalla(), { state: { ...base, transactions: [abono('t1', 900)] } });

    expect(screen.getByText('Ya pagados')).toBeInTheDocument();
    expect(screen.getByText('Pagado ✓')).toBeInTheDocument();
  });

  it('en escritorio pinta la rejilla de 2 columnas', async () => {
    const { container } = await renderFeature(pantalla(true), { state: base });

    const rejilla = container.querySelector('.grid.grid-cols-2');
    expect(rejilla).not.toBeNull();
    expect(rejilla).toContainElement(screen.getByRole('button', { name: /Audífonos/ }));
  });
});

describe('alta de plan', () => {
  it('"Nuevo" abre el formulario en blanco y crear lo agrega', async () => {
    const { user, store } = await renderFeature(pantalla(), { state: { categories: [compras] } });

    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    await screen.findByText('Nuevo plan MSI');

    await user.type(screen.getByPlaceholderText('Ej. Laptop'), 'Laptop');
    const [monto] = screen.getAllByRole('spinbutton');
    await user.type(monto!, '12000');
    await user.click(screen.getByRole('button', { name: 'Crear plan' }));

    expect(store.getState().installmentPlans).toEqual([
      {
        id: 'msi_nuevo', description: 'Laptop', store: '', totalAmount: 12000,
        installmentsCount: 6, categoryId: 'compras', startDate: expect.any(String),
        createdAt: AHORA, updatedAt: AHORA,
      },
    ]);
    expect(store.getState().toast).toBe('Plan creado');
    expect(store.getState().msiModalOpen).toBe(false);
  });
});

describe('edición de plan', () => {
  it('abrir un plan muestra su progreso y sus pagos registrados', async () => {
    const { user } = await renderFeature(pantalla(), {
      state: { ...base, transactions: [abono('t1', 225, '2026-01-15'), abono('t2', 75, '2026-02-20')] },
    });

    await user.click(screen.getByRole('button', { name: /Audífonos/ }));
    await screen.findByText('Editar plan MSI');

    expect(screen.getByText('$300.00 pagado · $600.00 restante')).toBeInTheDocument();
    expect(screen.getByText('Pagos registrados')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('$225.00')).toBeInTheDocument();
  });

  it('cambiar el monto total recalcula el avance', async () => {
    const { user, store } = await renderFeature(pantalla(), {
      state: { ...base, transactions: [abono('t1', 225)] },
    });

    await user.click(screen.getByRole('button', { name: /Audífonos/ }));
    await screen.findByText('Editar plan MSI');
    const [monto] = screen.getAllByRole('spinbutton');
    await user.clear(monto!);
    await user.type(monto!, '450');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(store.getState().toast).toBe('Plan actualizado');
    const tarjeta = await screen.findByRole('button', { name: /Audífonos/ });
    expect(within(tarjeta).getByText('$225.00 de $450.00')).toBeInTheDocument();
  });
});

describe('borrado de plan', () => {
  it('avisa de que los pagos se quedan, y al confirmar deja lápida', async () => {
    const { user, store } = await renderFeature(pantalla(), {
      state: { ...base, transactions: [abono('t1', 225)] },
    });

    await user.click(screen.getByRole('button', { name: /Audífonos/ }));
    await screen.findByText('Editar plan MSI');
    await user.click(screen.getByRole('button', { name: 'Eliminar plan' }));

    expect(screen.getByText(/Tus pagos ya registrados se quedan/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(store.getState().installmentPlans).toEqual([]);
    expect(store.getState().tombstones).toEqual([{ id: 'msi_1', deletedAt: AHORA }]);
    // El movimiento NO se borra: solo deja de agruparse como MSI.
    expect(store.getState().transactions).toHaveLength(1);
    expect(store.getState().toast).toBe('Plan eliminado');
  });
});
