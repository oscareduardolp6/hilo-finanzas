import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import App from '../../hilo-finanzas.jsx';
import {
  saveState,
  saveOcrSettings,
  buildDefaultTransactions,
  buildDefaultInstallmentPlans,
  createDeps,
  indexedDbStateRepository,
  fakeAuthGateway,
} from '../../hilo-finanzas.jsx';

/* Sesión de mentira para toda la suite de integración: `App` ahora exige
   login antes de montar el store (ver tasks/backend-sync.md), así que
   `renderApp()` inyecta un `authGateway` ya "logueado" y mantiene
   `stateRepository` apuntando a IndexedDB (fake-indexeddb) en vez de
   Firestore, que es justo lo que `seedState` ya escribía antes de este
   cambio — ningún test individual necesita enterarse. */
const TEST_USER = { uid: 'test-uid', email: 'test@example.com', displayName: 'Test' };

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

/* Monta <App/> ya autenticado y espera a que pase la pantalla "Cargando…".
   Devuelve el user-event. */
export async function renderApp() {
  const user = userEvent.setup();
  const deps = createDeps({
    stateRepository: indexedDbStateRepository,
    authGateway: fakeAuthGateway(TEST_USER),
  });
  render(<App deps={deps} />);
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
