/* El historial por su container, sin montar `<App/>`.

   El cursor de mes arranca en el mes real en curso, así que las fechas se
   construyen sobre él — igual que en el test de Inicio. */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import type { Account, Category, InstallmentPlan, Transaction } from '../../../shared/domain/types';
import { renderFeature } from '../../../test/render-feature';
import { HistoryContainer } from './containers/HistoryContainer';

const ahora = new Date();
const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 0 };
const banco: Account = { id: 'a2', name: 'Banco', type: 'debito', color: '#7B9CC7', initialBalance: 0 };

const comida: Category = { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#3F9C8B', type: 'expense' };
const ropa: Category = { id: 'ropa', name: 'Ropa', icon: 'Shirt', color: '#C77B7B', type: 'expense' };
const sueldo: Category = { id: 'sueldo', name: 'Sueldo', icon: 'Briefcase', color: '#6FA8A0', type: 'income' };

const audifonos: InstallmentPlan = {
  id: 'msi_1', description: 'Audífonos', store: 'Walmart', totalAmount: 900,
  installmentsCount: 6, categoryId: 'ropa', startDate: '2026-01-01', createdAt: 1,
};

const tacos: Transaction = {
  id: 'g1', type: 'expense', date: `${mes}-05`, amount: 180, description: 'Tacos',
  accountId: 'a1', categoryId: 'comida', store: 'Oxxo', createdAt: 1,
};
const tenis: Transaction = {
  id: 'g2', type: 'expense', date: `${mes}-06`, amount: 300, description: 'Tenis',
  accountId: 'a1', categoryId: 'ropa', store: 'Walmart', createdAt: 2,
};
const quincena: Transaction = {
  id: 'i1', type: 'income', date: `${mes}-01`, amount: 500, description: 'Quincena',
  accountId: 'a1', categoryId: 'sueldo', createdAt: 3,
};
const abono: Transaction = {
  id: 'p1', type: 'transfer', date: `${mes}-07`, amount: 150, description: 'Pago',
  fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: true,
  categoryId: 'ropa', installmentPlanId: 'msi_1', createdAt: 4,
};
/* De hace años: solo aparece con "todo el tiempo" o buscando. */
const antiguo: Transaction = {
  id: 'g0', type: 'expense', date: '2020-05-01', amount: 50, description: 'Café antiguo',
  accountId: 'a1', categoryId: 'comida', store: 'Oxxo', createdAt: 0,
};

const base = {
  accounts: [efectivo, banco],
  categories: [comida, ropa, sueldo],
  installmentPlans: [audifonos],
  transactions: [tacos, tenis, quincena, abono, antiguo],
};

/** Las filas de movimiento: son los únicos botones con importe. */
const filas = (container: HTMLElement) =>
  [...container.querySelectorAll('button')]
    .map(b => b.textContent || '')
    .filter(t => t.includes('$'));

const contiene = (container: HTMLElement, texto: string) =>
  filas(container).some(f => f.includes(texto));

describe('alcance temporal', () => {
  it('por defecto solo el mes en curso', async () => {
    const { container } = await renderFeature(<HistoryContainer />, { state: base });

    expect(contiene(container, 'Tacos')).toBe(true);
    expect(contiene(container, 'Café antiguo')).toBe(false);
  });

  it('"Ver todo el tiempo" trae los de otros meses y desactiva el pager', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'Ver todo el tiempo' }));

    expect(contiene(container, 'Café antiguo')).toBe(true);
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
    expect(screen.getByText('Todo el tiempo')).toBeInTheDocument();
  });
});

describe('filtros', () => {
  it('por tipo: "Ingresos" deja solo el ingreso', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'Ingresos' }));

    expect(filas(container)).toHaveLength(1);
    expect(contiene(container, 'Quincena')).toBe(true);
  });

  it('"MSI" no filtra por tipo de movimiento, sino por tener plan vinculado', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'MSI' }));

    expect(filas(container)).toHaveLength(1);
    expect(contiene(container, 'Pago')).toBe(true);
  });

  it('el desplegable de categoría solo ofrece las de gasto', async () => {
    await renderFeature(<HistoryContainer />, { state: base });

    const select = screen.getByDisplayValue('Todas las categorías');
    const opciones = [...select.querySelectorAll('option')].map(o => o.textContent);
    expect(opciones).toEqual(['Todas las categorías', 'Comida', 'Ropa']);
  });

  it('categoría y tienda se componen', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.selectOptions(screen.getByDisplayValue('Todas las categorías'), 'ropa');
    await user.selectOptions(screen.getByDisplayValue('Todas las tiendas'), 'Walmart');

    // El abono también es de "ropa", pero su tienda es null: lo descarta el
    // segundo filtro.
    expect(filas(container)).toHaveLength(1);
    expect(contiene(container, 'Tenis')).toBe(true);
  });

  it('sin resultados lo dice, y distingue filtros de búsqueda', async () => {
    const { user } = await renderFeature(<HistoryContainer />, { state: base });

    await user.selectOptions(screen.getByDisplayValue('Todas las tiendas'), 'Oxxo');
    await user.click(screen.getByRole('button', { name: 'Ingresos' }));

    expect(screen.getByText('No hay movimientos con estos filtros.')).toBeInTheDocument();
  });
});

describe('buscador', () => {
  it('busca en todo el tiempo aunque el cursor esté en el mes actual', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'cafe');

    // Sin acentos y en minúsculas encuentra "Café antiguo", de 2020.
    expect(contiene(container, 'Café antiguo')).toBe(true);
    expect(screen.getByText('Buscando en todo el tiempo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
  });

  it('encuentra un abono por el nombre de su plan MSI', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'audifonos');

    expect(filas(container)).toHaveLength(1);
    expect(contiene(container, 'Pago')).toBe(true);
  });

  it('resalta lo que coincide', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'Tacos');

    expect(container.querySelector('mark')).not.toBeNull();
  });

  it('la X limpia la búsqueda y devuelve el pager', async () => {
    const { user, container } = await renderFeature(<HistoryContainer />, { state: base });

    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'cafe');
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(contiene(container, 'Café antiguo')).toBe(false);
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();
  });

  it('sin coincidencias lo dice con su propio texto', async () => {
    const { user } = await renderFeature(<HistoryContainer />, { state: base });

    await user.type(screen.getByPlaceholderText('Buscar en el historial…'), 'zzzz');

    expect(screen.getByText('No hay movimientos que coincidan.')).toBeInTheDocument();
  });

  it('ofrece como sugerencias lo ya escrito, planes incluidos', async () => {
    const { container } = await renderFeature(<HistoryContainer />, { state: base });

    const opciones = [...container.querySelectorAll('datalist option')].map(o => o.getAttribute('value'));
    expect(opciones).toContain('Audífonos');
    expect(opciones).toContain('Tacos');
    expect(opciones).toContain('Walmart');
  });
});

describe('abrir un movimiento', () => {
  it('lo lleva a la hoja de edición', async () => {
    const { user, store } = await renderFeature(<HistoryContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: /^Tenis/ }));

    expect(store.getState().sheetOpen).toBe(true);
    expect(store.getState().editingId).toBe('g2');
  });
});

describe('escritorio', () => {
  it('monta la variante ancha con los mismos datos', async () => {
    const { container } = await renderFeature(<HistoryContainer desktop />, { state: base });

    expect(container.querySelector('.rounded-2xl.p-6')).not.toBeNull();
    expect(contiene(container, 'Tacos')).toBe(true);
    // Su `datalist` tiene id propio para no chocar con el de la vista móvil.
    expect(container.querySelector('#history-search-list-desktop')).not.toBeNull();
  });
});
