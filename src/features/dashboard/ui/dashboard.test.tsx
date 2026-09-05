/* Inicio por su container, sin montar `<App/>`.

   Las fechas se construyen sobre el mes real en curso: el cursor de mes arranca
   ahí (`currentMonthStart`), y es lo único de la feature que no pasa por el
   reloj inyectado — moverlo al reloj sería cambiar comportamiento. */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import type { Account, Category, InstallmentPlan, Transaction } from '../../../shared/domain/types';
import { renderFeature } from '../../../test/render-feature';
import { HomeContainer } from './containers/HomeContainer';

const ahora = new Date();
const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
/* Un mes de 2020: sirve para lo que debe quedar fuera del periodo. */
const OTRO_MES = '2020-01';

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 1000 };
const banco: Account = { id: 'a2', name: 'Banco', type: 'debito', color: '#7B9CC7', initialBalance: 5000 };

const comida: Category = { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#3F9C8B', type: 'expense' };
const ropa: Category = { id: 'ropa', name: 'Ropa', icon: 'Shirt', color: '#C77B7B', type: 'expense' };
const sueldo: Category = { id: 'sueldo', name: 'Sueldo', icon: 'Briefcase', color: '#6FA8A0', type: 'income' };

const movimientos: Transaction[] = [
  { id: 'i1', type: 'income', date: `${mes}-01`, amount: 500, description: 'Quincena', accountId: 'a1', categoryId: 'sueldo', createdAt: 1 },
  { id: 'g1', type: 'expense', date: `${mes}-02`, amount: 100, description: 'Súper', accountId: 'a1', categoryId: 'comida', createdAt: 2 },
  { id: 'g2', type: 'expense', date: `${mes}-03`, amount: 300, description: 'Tenis', accountId: 'a2', categoryId: 'ropa', createdAt: 3 },
];

const base = {
  accounts: [efectivo, banco],
  categories: [comida, ropa, sueldo],
  transactions: movimientos,
};

describe('resumen del mes', () => {
  it('pinta saldo total, ingresos y gastos del periodo', async () => {
    await renderFeature(<HomeContainer />, { state: base });

    // 1000 + 5000 + 500 − 100 − 300
    expect(screen.getByText('$6,100.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    // El total de gastos sale dos veces: en el resumen y en el centro de la dona.
    expect(screen.getAllByText('$400.00')).toHaveLength(2);
  });

  it('el saldo total NO depende del mes: es de siempre, no del periodo', async () => {
    const { user } = await renderFeature(<HomeContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));

    expect(screen.getByText('$6,100.00')).toBeInTheDocument();
    // Los totales del periodo sí se vacían.
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/Aún no hay gastos este mes/)).toBeInTheDocument();
    expect(screen.getByText('Aún no hay movimientos este mes.')).toBeInTheDocument();
  });

  it('el pager vuelve al mes de origen', async () => {
    const { user } = await renderFeature(<HomeContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }));

    expect(screen.getAllByText('$400.00')).toHaveLength(2);
  });
});

describe('gastos por categoría', () => {
  it('lista cada categoría con su porcentaje, de mayor a menor', async () => {
    await renderFeature(<HomeContainer />, { state: base });

    // El nombre accesible sale sin espacios entre los <span>; es lo que dice el
    // DOM, y así la aserción cubre de una vez orden, nombre, % e importe.
    const leyenda = screen.getAllByRole('button').filter(b => (b.textContent || '').includes('%'));
    expect(leyenda.map(b => b.textContent)).toEqual(['Ropa75%$300.00', 'Comida25%$100.00']);
  });

  it('tocar una categoría salta al historial ya filtrado por ella', async () => {
    const { user, store } = await renderFeature(<HomeContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: /^Ropa/ }));

    expect(store.getState()).toMatchObject({
      activeTab: 'history',
      filterCategory: 'ropa',
      // El filtro de tipo se limpia: si estaba en "ingresos" no habría nada que ver.
      filterType: 'all',
      showAllTime: false,
    });
  });

  it('un mes sin gastos invita a registrar el primero, en vez de una dona vacía', async () => {
    await renderFeature(<HomeContainer />, { state: { ...base, transactions: [] } });

    expect(screen.getByText(/Usa el botón \+ para registrar el primero/)).toBeInTheDocument();
  });
});

describe('movimientos recientes', () => {
  it('lista los del mes y deja fuera los de otros meses', async () => {
    const viejo: Transaction = {
      id: 'g0', type: 'expense', date: `${OTRO_MES}-05`, amount: 50, description: 'Antiguo',
      accountId: 'a1', categoryId: 'comida', createdAt: 0,
    };
    await renderFeature(<HomeContainer />, { state: { ...base, transactions: [...movimientos, viejo] } });

    expect(screen.getByRole('button', { name: /^Tenis/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Súper/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Antiguo/ })).not.toBeInTheDocument();
  });

  it('tocar uno abre su hoja de edición', async () => {
    const { user, store } = await renderFeature(<HomeContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: /^Tenis/ }));

    expect(store.getState().sheetOpen).toBe(true);
    expect(store.getState().editingId).toBe('g2');
  });
});

describe('compras a meses', () => {
  const audifonos: InstallmentPlan = {
    id: 'msi_1', description: 'Audífonos', store: 'Walmart', totalAmount: 900,
    installmentsCount: 6, categoryId: 'comida', startDate: '2026-01-01', createdAt: 10,
  };
  const laptop: InstallmentPlan = { ...audifonos, id: 'msi_2', description: 'Laptop', totalAmount: 12000, createdAt: 20 };

  /* Un abono de otro mes: liquida el plan sin tocar los totales del periodo. */
  const liquidacion: Transaction = {
    id: 'p1', type: 'transfer', date: `${OTRO_MES}-15`, amount: 900, description: 'Pago',
    fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: true,
    categoryId: 'comida', installmentPlanId: 'msi_1', createdAt: 11,
  };

  it('un plan ya pagado desaparece de Inicio; el activo se queda', async () => {
    await renderFeature(<HomeContainer />, {
      state: { ...base, installmentPlans: [audifonos, laptop], transactions: [...movimientos, liquidacion] },
    });

    expect(screen.getByRole('button', { name: /^Laptop/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Audífonos/ })).not.toBeInTheDocument();
  });

  it('sin planes activos, el bloque entero no se pinta', async () => {
    await renderFeature(<HomeContainer />, {
      state: { ...base, installmentPlans: [audifonos], transactions: [...movimientos, liquidacion] },
    });

    expect(screen.queryByText('Compras a meses')).not.toBeInTheDocument();
  });

  it('tocar un plan abre su formulario', async () => {
    const { user, store } = await renderFeature(<HomeContainer />, {
      state: { ...base, installmentPlans: [laptop] },
    });

    await user.click(screen.getByRole('button', { name: /^Laptop/ }));

    expect(store.getState().msiModalOpen).toBe(true);
    expect(store.getState().editingPlan).toMatchObject({ id: 'msi_2' });
  });
});

describe('escritorio', () => {
  it('reparte el mismo contenido en la rejilla de 3 columnas', async () => {
    const { container } = await renderFeature(<HomeContainer desktop />, { state: base });

    const rejilla = container.querySelector('.grid.grid-cols-3');
    expect(rejilla).not.toBeNull();
    expect(rejilla).toContainElement(screen.getByText('$6,100.00'));
    expect(screen.getAllByText('$400.00')).toHaveLength(2);
  });
});
