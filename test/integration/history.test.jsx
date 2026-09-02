import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp, gotoTab, seedState } from './helpers.jsx';

const now = new Date();
const TODAY = now.toISOString().slice(0, 10);
const LAST_MONTH = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 10);

const seed = {
  accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 0 }],
  categories: [
    { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' },
    { id: 'salario', name: 'Salario', icon: 'Wallet', color: '#4FA57B', type: 'income' },
  ],
  transactions: [
    { id: 't1', type: 'expense', date: TODAY, amount: 180, description: 'Tacos al pastor', store: 'Taquería', accountId: 'acc1', categoryId: 'comida', createdAt: 3, updatedAt: 3 },
    { id: 't2', type: 'income', date: TODAY, amount: 5000, description: 'Nómina quincena', accountId: 'acc1', categoryId: 'salario', createdAt: 2, updatedAt: 2 },
    { id: 't3', type: 'expense', date: LAST_MONTH, amount: 400, description: 'Despensa', store: 'Walmart', accountId: 'acc1', categoryId: 'comida', createdAt: 1, updatedAt: 1 },
  ],
};

async function goHistory() {
  const user = await renderApp();
  await gotoTab(user, 'Historial');
  return user;
}

describe('Historial: mes vs todo el tiempo', () => {
  it('por defecto muestra sólo el mes en curso', async () => {
    await seedState(seed);
    await goHistory();
    expect(await screen.findByText('Tacos al pastor')).toBeInTheDocument();
    expect(screen.getByText('Nómina quincena')).toBeInTheDocument();
    expect(screen.queryByText('Despensa')).not.toBeInTheDocument();
  });
});

describe('Historial: filtro por tipo', () => {
  it('"Ingresos" deja sólo los ingresos', async () => {
    await seedState(seed);
    const user = await goHistory();
    await user.click(screen.getByRole('button', { name: 'Ingresos' }));
    expect(await screen.findByText('Nómina quincena')).toBeInTheDocument();
    expect(screen.queryByText('Tacos al pastor')).not.toBeInTheDocument();
  });
});

describe('Historial: filtro por categoría', () => {
  it('el select de categoría (sólo gasto) descarta el ingreso', async () => {
    await seedState(seed);
    const user = await goHistory();
    // El input de búsqueda con datalist también expone role "combobox"; nos
    // quedamos con los <select>.
    const categorySelect = screen.getAllByRole('combobox').filter(el => el.tagName === 'SELECT')[0];
    await user.selectOptions(categorySelect, 'comida');
    expect(await screen.findByText('Tacos al pastor')).toBeInTheDocument();
    expect(screen.queryByText('Nómina quincena')).not.toBeInTheDocument();
  });
});

describe('Historial: buscador', () => {
  it('busca en todo el tiempo, deshabilita el pager y resalta la coincidencia', async () => {
    await seedState(seed);
    const user = await goHistory();
    const box = screen.getByPlaceholderText('Buscar en el historial…');

    await user.type(box, 'tacos');
    expect(await screen.findByText('Buscando en todo el tiempo')).toBeInTheDocument();
    expect(screen.queryByText('Nómina quincena')).not.toBeInTheDocument();

    // el pager de mes queda deshabilitado
    const prev = screen.getByRole('button', { name: 'Mes anterior' });
    expect(prev).toBeDisabled();

    // la coincidencia va dentro de un <mark>
    expect(screen.getByText('Tacos', { selector: 'mark' })).toBeInTheDocument();
  });

  it('matchea contra la tienda aunque el movimiento sea de otro mes', async () => {
    await seedState(seed);
    const user = await goHistory();
    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'walmart');
    expect(await screen.findByText('Despensa')).toBeInTheDocument();
  });

  it('limpiar la búsqueda restaura la vista por mes', async () => {
    await seedState(seed);
    const user = await goHistory();
    const box = screen.getByPlaceholderText('Buscar en el historial…');
    await user.type(box, 'walmart');
    await screen.findByText('Despensa');

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('button', { name: 'Ver todo el tiempo' })).toBeInTheDocument();
    expect(screen.queryByText('Despensa')).not.toBeInTheDocument();
  });
});
