import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import App from '../../hilo-finanzas.jsx';
import {
  saveState,
  saveOcrSettings,
  buildDefaultTransactions,
  buildDefaultInstallmentPlans,
} from '../../hilo-finanzas.jsx';

/* Siembra IndexedDB con un blob antes de montar <App/> (App lo hidrata en el
   primer efecto). Sin argumento, App se queda con sus datos de ejemplo. */
export async function seedState(partial) {
  await saveState({
    accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [],
    ...partial,
  });
}

export async function seedOcr(settings) {
  await saveOcrSettings(settings);
}

/* Monta <App/> y espera a que pase la pantalla "Cargando…". Devuelve el user-event. */
export async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => {
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
  });
  return user;
}

export async function gotoTab(user, label) {
  await user.click(screen.getByRole('button', { name: label }));
}

/* Abre la hoja de "Nuevo movimiento" desde el FAB. */
export async function openAddSheet(user) {
  await user.click(screen.getByRole('button', { name: 'Agregar movimiento' }));
  await screen.findByText('Nuevo movimiento');
}

export { buildDefaultTransactions, buildDefaultInstallmentPlans, screen, waitFor };
