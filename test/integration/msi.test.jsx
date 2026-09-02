import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, openAddSheet, gotoTab, seedState } from './helpers.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

const seed = {
  accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 5000 }],
  categories: [{ id: 'compras', name: 'Compras', icon: 'ShoppingBag', color: '#4FA8A0', type: 'expense' }],
  installmentPlans: [{
    id: 'plan1', description: 'Laptop', store: 'Costco',
    totalAmount: 900, installmentsCount: 6, categoryId: 'compras',
    startDate: TODAY, createdAt: 1, updatedAt: 1,
  }],
};

async function addMsiPayment(user, amount) {
  await openAddSheet(user);
  const sheet = screen.getByText('Nuevo movimiento').closest('.hilo-sheet');
  const s = within(sheet);
  const amt = s.getByPlaceholderText('0.00');
  await user.clear(amt);
  await user.type(amt, String(amount));
  await user.click(s.getByRole('button', { name: 'Vincular a un plan de MSI' }));
  await user.click(await s.findByRole('button', { name: /Laptop/ }));
  await user.click(s.getByRole('button', { name: 'Efectivo' }));
  await user.click(s.getByRole('button', { name: 'Agregar' }));
  await screen.findByText('Movimiento agregado');
}

describe('plan MSI con pagos parciales', () => {
  it('un abono parcial avanza el progreso y el plan sigue activo', async () => {
    await seedState(seed);
    const user = await renderApp();

    await gotoTab(user, 'MSI');
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Quedan $900.00')).toBeInTheDocument();

    await addMsiPayment(user, 300);

    await gotoTab(user, 'MSI');
    expect(await screen.findByText('Quedan $600.00')).toBeInTheDocument();
    expect(screen.getByText('$300.00 de $900.00')).toBeInTheDocument();
    // sigue en activos, no en "Ya pagados"
    expect(screen.queryByText('Ya pagados')).not.toBeInTheDocument();
  });

  it('al cubrir el total pasa a "Ya pagados" con "Pagado ✓"', async () => {
    await seedState(seed);
    const user = await renderApp();

    await addMsiPayment(user, 300);
    await addMsiPayment(user, 600);

    await gotoTab(user, 'MSI');
    expect(await screen.findByText('Ya pagados')).toBeInTheDocument();
    expect(screen.getByText('Pagado ✓')).toBeInTheDocument();
  });
});
