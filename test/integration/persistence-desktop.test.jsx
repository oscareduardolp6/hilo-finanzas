import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { saveState } from '../../hilo-finanzas.jsx';
import { renderApp, openAddSheet, gotoTab, seedState } from './helpers.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

const oneAccount = {
  accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000 }],
  categories: [{ id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' }],
};

describe('persistencia en IndexedDB', () => {
  it('un movimiento agregado sobrevive a re-montar <App/>', async () => {
    await seedState(oneAccount);
    const user = await renderApp();

    await openAddSheet(user);
    const amt = screen.getByPlaceholderText('0.00');
    await user.clear(amt);
    await user.type(amt, '321');
    await user.click(screen.getByRole('button', { name: 'Comida' }));
    await user.click(screen.getByRole('button', { name: 'Efectivo' }));
    await user.type(screen.getByPlaceholderText(/Tacos, Uber, Renta/), 'Persistente');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    await screen.findByText('Movimiento agregado');

    // Desmonta la primera instancia y monta una nueva: rehidrata desde IndexedDB
    cleanup();
    const user2 = await renderApp();
    await gotoTab(user2, 'Historial');
    expect(await screen.findByText('Persistente')).toBeInTheDocument();
  });

  it('si el guardado local falla, muestra un toast de error', async () => {
    await seedState(oneAccount);
    const user = await renderApp();

    // Rompe IndexedDB después de la carga inicial.
    const realOpen = window.indexedDB.open.bind(window.indexedDB);
    window.indexedDB.open = () => { throw new Error('IndexedDB caído'); };
    try {
      await openAddSheet(user);
      const amt = screen.getByPlaceholderText('0.00');
      await user.clear(amt);
      await user.type(amt, '10');
      await user.click(screen.getByRole('button', { name: 'Comida' }));
      await user.click(screen.getByRole('button', { name: 'Efectivo' }));
      await user.click(screen.getByRole('button', { name: 'Agregar' }));
      expect(await screen.findByText('No se pudo guardar el cambio localmente')).toBeInTheDocument();
    } finally {
      window.indexedDB.open = realOpen;
    }
  });
});

describe('compatibilidad: blob viejo', () => {
  it('renderiza transacciones sin updatedAt / size / brand / quantity y sin colección tombstones', async () => {
    // Escrito "a mano" como un build anterior: sin tombstones, sin updatedAt ni product-detail.
    await saveState({
      accounts: oneAccount.accounts,
      categories: oneAccount.categories,
      transactions: [{ id: 'legacy1', type: 'expense', date: TODAY, amount: 50, description: 'Legacy', accountId: 'acc1', categoryId: 'comida', createdAt: 1 }],
      installmentPlans: [],
    });
    const user = await renderApp();
    await gotoTab(user, 'Historial');
    expect(await screen.findByText('Legacy')).toBeInTheDocument();
    // y se puede abrir a editar sin romper
    await user.click(screen.getByText('Legacy'));
    expect(await screen.findByText('Editar gasto')).toBeInTheDocument();
  });
});

describe('layout de escritorio', () => {
  it('a >= 1024px monta DesktopShell (sidebar) en vez de BottomNav', async () => {
    window.matchMedia = (query) => ({
      matches: true, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => {},
    });
    window.innerWidth = 1280;

    await seedState(oneAccount);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Nueva transacción')).toBeInTheDocument();
    // el saldo total (1000) se muestra igual que en móvil
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThan(0);
  });
});
