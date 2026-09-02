import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, openAddSheet, gotoTab, seedState } from './helpers.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

/* Flujos de alta/edición/borrado de movimientos sobre <App/> real. Se parte de
   un estado vacío sembrado en IndexedDB para que los totales sean predecibles. */

const oneAccount = {
  accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000 }],
  categories: [
    { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' },
    { id: 'salario', name: 'Salario', icon: 'Wallet', color: '#4FA57B', type: 'income' },
  ],
};

const twoAccounts = {
  ...oneAccount,
  accounts: [
    ...oneAccount.accounts,
    { id: 'acc2', name: 'Banco', type: 'debito', color: '#8D5FB0', initialBalance: 0 },
  ],
};

async function fillAmount(user, value) {
  const amount = screen.getByPlaceholderText('0.00');
  await user.clear(amount);
  await user.type(amount, value);
}

describe('alta de gasto', () => {
  it('agrega el gasto, baja el saldo y aparece en el historial', async () => {
    await seedState(oneAccount);
    const user = await renderApp();

    await openAddSheet(user);
    await fillAmount(user, '250');
    await user.click(screen.getByRole('button', { name: 'Comida' }));
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    await user.type(screen.getByPlaceholderText(/Tacos, Uber, Renta/), 'Prueba gasto');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Movimiento agregado')).toBeInTheDocument();

    await gotoTab(user, 'Historial');
    expect(await screen.findByText('Prueba gasto')).toBeInTheDocument();
    // saldo de la cuenta: 1000 - 250 (aparece como saldo de cuenta y en el total del pie)
    await gotoTab(user, 'Cuentas');
    expect((await screen.findAllByText('$750.00')).length).toBeGreaterThan(0);
  });
});

describe('alta de ingreso', () => {
  it('sube el saldo total', async () => {
    await seedState(oneAccount);
    const user = await renderApp();

    await openAddSheet(user);
    await user.click(screen.getByRole('button', { name: 'Ingreso' }));
    await fillAmount(user, '500');
    await user.click(screen.getByRole('button', { name: 'Salario' }));
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Movimiento agregado')).toBeInTheDocument();
    await gotoTab(user, 'Cuentas');
    // saldo de la cuenta y "Saldo total" del pie, ambos 1000 + 500
    const found = await screen.findAllByText('$1,500.00');
    expect(found.length).toBeGreaterThan(0);
  });
});

describe('transferencia simple', () => {
  it('mueve saldo entre cuentas sin cambiar el saldo total', async () => {
    await seedState(twoAccounts);
    const user = await renderApp();

    await openAddSheet(user);
    await user.click(screen.getByRole('button', { name: 'Transferencia' }));
    await fillAmount(user, '300');
    // Por defecto: Desde = Efectivo (acc1), Hacia = Banco (acc2). No hace falta tocar chips.
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Movimiento agregado')).toBeInTheDocument();

    await gotoTab(user, 'Cuentas');
    // Efectivo 1000-300=700, Banco 0+300=300, total sigue 1000
    expect(await screen.findByText('$700.00')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    // "Saldo total" del pie de Cuentas sigue en 1000
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
  });
});

describe('transferencia marcada como gasto', () => {
  it('cuenta como gasto por categoría sin descontar del saldo total', async () => {
    await seedState(twoAccounts);
    const user = await renderApp();

    await openAddSheet(user);
    await user.click(screen.getByRole('button', { name: 'Transferencia' }));
    await fillAmount(user, '200');
    await user.click(screen.getByRole('button', { name: 'Marcar como gasto' }));
    await user.click(screen.getByRole('button', { name: 'Comida' }));
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Movimiento agregado')).toBeInTheDocument();

    // Home: aparece en "Gastos" del mes (y en la leyenda de la categoría)
    expect((await screen.findAllByText('$200.00')).length).toBeGreaterThan(0);

    await gotoTab(user, 'Historial');
    expect(await screen.findByText('Cuenta como gasto · Comida')).toBeInTheDocument();

    // El saldo total NO baja (el dinero ya salió como transferencia)
    await gotoTab(user, 'Cuentas');
    expect((await screen.findAllByText('$1,000.00')).length).toBeGreaterThan(0);
  });
});

describe('editar movimiento', () => {
  it('reabre desde el historial, cambia el monto y persiste', async () => {
    await seedState({
      ...oneAccount,
      transactions: [{
        id: 'txn_edit', type: 'expense', date: TODAY, amount: 100,
        description: 'Café', accountId: 'acc1', categoryId: 'comida',
        createdAt: 1, updatedAt: 1,
      }],
    });
    const user = await renderApp();

    await gotoTab(user, 'Historial');
    await user.click(await screen.findByText('Café'));
    expect(await screen.findByText('Editar gasto')).toBeInTheDocument();

    await fillAmount(user, '175');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Movimiento actualizado')).toBeInTheDocument();
    expect(await screen.findByText('-$175.00')).toBeInTheDocument();
  });
});

describe('eliminar movimiento', () => {
  it('pide confirmación inline y luego lo quita', async () => {
    await seedState({
      ...oneAccount,
      transactions: [{
        id: 'txn_del', type: 'expense', date: TODAY, amount: 100,
        description: 'Gasto a borrar', accountId: 'acc1', categoryId: 'comida',
        createdAt: 1, updatedAt: 1,
      }],
    });
    const user = await renderApp();

    await gotoTab(user, 'Historial');
    await user.click(await screen.findByText('Gasto a borrar'));
    await user.click(await screen.findByRole('button', { name: 'Eliminar movimiento' }));
    // paso de confirmación
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Movimiento eliminado')).toBeInTheDocument();
    expect(screen.queryByText('Gasto a borrar')).not.toBeInTheDocument();
  });
});

describe('el monto se conserva al cambiar de tipo', () => {
  it('gasto -> ingreso -> transferencia mantiene el importe tecleado', async () => {
    await seedState(twoAccounts);
    const user = await renderApp();

    await openAddSheet(user);
    await fillAmount(user, '432');
    await user.click(screen.getByRole('button', { name: 'Ingreso' }));
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(432);
    await user.click(screen.getByRole('button', { name: 'Transferencia' }));
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(432);
  });
});
