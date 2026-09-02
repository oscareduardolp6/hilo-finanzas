import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, gotoTab, seedState } from './helpers.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

const base = {
  accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000 }],
  categories: [{ id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' }],
};

describe('alta de cuenta', () => {
  it('crea una cuenta nueva con su saldo inicial', async () => {
    await seedState(base);
    const user = await renderApp();

    await gotoTab(user, 'Cuentas');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Nueva cuenta');

    await user.type(screen.getByPlaceholderText(/NU, Mercado Pago/), 'Ahorros');
    const bal = screen.getByRole('spinbutton'); // input type=number "Saldo inicial"
    await user.clear(bal);
    await user.type(bal, '2500');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Cuenta creada')).toBeInTheDocument();
    expect(await screen.findByText('Ahorros')).toBeInTheDocument();
    expect(screen.getByText('$2,500.00')).toBeInTheDocument();
  });
});

describe('edición de cuenta', () => {
  it('cambiar el saldo inicial recalcula el saldo mostrado', async () => {
    await seedState(base);
    const user = await renderApp();

    await gotoTab(user, 'Cuentas');
    await user.click(await screen.findByRole('button', { name: /Efectivo/ }));
    await screen.findByText('Editar cuenta');

    const bal = screen.getByRole('spinbutton');
    await user.clear(bal);
    await user.type(bal, '1500');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Cuenta actualizada')).toBeInTheDocument();
    expect((await screen.findAllByText('$1,500.00')).length).toBeGreaterThan(0);
  });
});

describe('borrado de cuenta', () => {
  it('una cuenta con movimientos no se puede eliminar', async () => {
    await seedState({
      ...base,
      transactions: [{ id: 't', type: 'expense', date: TODAY, amount: 20, description: 'x', accountId: 'acc1', categoryId: 'comida', createdAt: 1, updatedAt: 1 }],
    });
    const user = await renderApp();

    await gotoTab(user, 'Cuentas');
    await user.click(await screen.findByRole('button', { name: /Efectivo/ }));
    await screen.findByText('Editar cuenta');

    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toBeDisabled();
    expect(screen.getByText(/no se puede eliminar/i)).toBeInTheDocument();
  });

  it('una cuenta sin movimientos sí se elimina (con confirmación)', async () => {
    await seedState({
      ...base,
      accounts: [
        ...base.accounts,
        { id: 'acc2', name: 'Sin uso', type: 'debito', color: '#8D5FB0', initialBalance: 0 },
      ],
    });
    const user = await renderApp();

    await gotoTab(user, 'Cuentas');
    await user.click(await screen.findByRole('button', { name: /Sin uso/ }));
    await screen.findByText('Editar cuenta');

    await user.click(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Cuenta eliminada')).toBeInTheDocument();
    expect(screen.queryByText('Sin uso')).not.toBeInTheDocument();
  });
});
