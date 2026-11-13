/* Evolución por su container, sin montar `<App/>`.

   Las fechas son relativas a hoy porque el container deriva "hoy" de
   `todayIso()`. La gráfica es SVG de recharts y no se mide en jsdom, así que las
   aserciones van sobre el resumen, que lleva las mismas cifras en texto. */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../app/App';
import { createDeps } from '../../../app/dependencies';
import { todayIso } from '../../../shared/domain/dates';
import type { Account, Transaction } from '../../../shared/domain/types';
import {
  fakeAuthGateway,
  inMemoryHideBalancesRepository,
  inMemoryStateRepository,
} from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { subtractMonthsIso } from '../domain/series';
import { EvolutionContainer } from './containers/EvolutionContainer';

const hoy = todayIso();
const hace2Meses = subtractMonthsIso(hoy, 2);
const hace8Meses = subtractMonthsIso(hoy, 8);

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 1000 };

const movimientos: Transaction[] = [
  { id: 'g0', type: 'expense', date: hace8Meses, amount: 300, description: 'Viejo', accountId: 'a1', categoryId: 'comida', createdAt: 1 },
  { id: 'i1', type: 'income', date: hace2Meses, amount: 2000, description: 'Bono', accountId: 'a1', categoryId: 'sueldo', createdAt: 2 },
  { id: 'g1', type: 'expense', date: hoy, amount: 500, description: 'Súper', accountId: 'a1', categoryId: 'comida', createdAt: 3 },
];

const base = { accounts: [efectivo], transactions: movimientos };

describe('resumen del plazo', () => {
  it('por defecto (6M) muestra saldo inicial, final y lo ahorrado', async () => {
    await renderFeature(<EvolutionContainer />, { state: base });

    // Antes de los 6 meses: 1000 − 300. Hoy: 700 + 2000 − 500.
    expect(screen.getByText('$700.00')).toBeInTheDocument();
    expect(screen.getByText('$2,200.00')).toBeInTheDocument();
    expect(screen.getByText('+$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('+214.3%')).toBeInTheDocument();
    expect(screen.getByText('Ahorro en el plazo')).toBeInTheDocument();
  });

  it('cambiar de plazo recalcula el resumen y se queda en el store', async () => {
    const { user, store } = await renderFeature(<EvolutionContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: '1M' }));

    // En el último mes solo cuenta el gasto de hoy.
    expect(screen.getByText('-$500.00')).toBeInTheDocument();
    expect(screen.getByText('$2,700.00')).toBeInTheDocument();
    expect(screen.getByText('Cambio en el plazo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().evolutionRange).toBe('1m');
  });

  it('"Todo" parte del primer movimiento', async () => {
    const { user } = await renderFeature(<EvolutionContainer />, { state: base });

    await user.click(screen.getByRole('button', { name: 'Todo' }));

    // Antes del primer movimiento solo estaba el saldo inicial de la cuenta.
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('+$1,200.00')).toBeInTheDocument();
  });

  it('una transferencia entre cuentas no mueve el ahorro', async () => {
    const banco: Account = { id: 'a2', name: 'Banco', type: 'debito', color: '#7B9CC7', initialBalance: 0 };
    const traspaso: Transaction = {
      id: 't1', type: 'transfer', date: hoy, amount: 400, description: 'Traspaso',
      fromAccountId: 'a1', toAccountId: 'a2', taggedAsExpense: false, categoryId: null, createdAt: 4,
    };
    await renderFeature(<EvolutionContainer />, { state: { accounts: [efectivo, banco], transactions: [traspaso] } });

    expect(screen.getAllByText('$1,000.00')).toHaveLength(2);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});

describe('sin movimientos', () => {
  it('invita a registrar el primero en vez de una gráfica vacía', async () => {
    await renderFeature(<EvolutionContainer />, { state: { accounts: [efectivo], transactions: [] } });

    expect(screen.getByText(/Aún no hay movimientos/)).toBeInTheDocument();
  });
});

describe('modo privado', () => {
  it('oculta los montos y el signo, pero conserva el porcentaje', async () => {
    await renderFeature(<EvolutionContainer />, {
      state: base,
      deps: { hideBalancesRepository: inMemoryHideBalancesRepository({ initial: true }) },
    });

    expect(screen.getAllByText('$••••')).toHaveLength(3);
    expect(screen.queryByText(/1,500/)).not.toBeInTheDocument();
    expect(screen.queryByText('+$••••')).not.toBeInTheDocument();
    expect(screen.getByText('+214.3%')).toBeInTheDocument();
  });
});

describe('escritorio', () => {
  it('reparte la gráfica y el resumen en la rejilla de 3 columnas', async () => {
    const { container } = await renderFeature(<EvolutionContainer desktop />, { state: base });

    const rejilla = container.querySelector('.grid.grid-cols-3');
    expect(rejilla).not.toBeNull();
    expect(rejilla).toContainElement(screen.getByText('+$1,500.00'));
    expect(rejilla).toContainElement(screen.getByRole('button', { name: '3A' }));
  });
});

describe('navegación', () => {
  it('la pestaña "Evolución" está en la barra y monta la vista', async () => {
    const deps = createDeps({
      stateRepository: inMemoryStateRepository({ initial: { ...base, categories: [], installmentPlans: [], tombstones: [], benefitPrograms: [] } }),
      authGateway: fakeAuthGateway({ uid: 'u', email: 'u@example.com', displayName: 'U' }),
    });
    const user = userEvent.setup();
    render(<App deps={deps} />);

    await user.click(await screen.findByRole('button', { name: 'Evolución' }));

    expect(await screen.findByText('Ahorro en el plazo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6M' })).toHaveAttribute('aria-pressed', 'true');
  });
});
