import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderApp, gotoTab, seedState } from './helpers.jsx';
import { buildExportPayload } from '../../hilo-finanzas.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const NOW = Date.now();

const incoming = {
  accounts: [{ id: 'accX', name: 'Cuenta Importada', type: 'debito', color: '#8D5FB0', initialBalance: 0, createdAt: NOW, updatedAt: NOW }],
  categories: [],
  transactions: [{ id: 'txnX', type: 'income', date: TODAY, amount: 999, description: 'Ingreso sincronizado', accountId: 'accX', categoryId: null, createdAt: NOW, updatedAt: NOW }],
  installmentPlans: [],
  tombstones: [],
};

async function openSettings(user) {
  await user.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
  await screen.findByText('Ajustes');
}

describe('Respaldo: restaurar reemplazando todo', () => {
  it('carga un archivo de respaldo y reemplaza el estado', async () => {
    await seedState({
      accounts: [{ id: 'viejo', name: 'Cuenta Vieja', type: 'efectivo', color: '#C9A24B', initialBalance: 50 }],
      transactions: [{ id: 'tv', type: 'expense', date: TODAY, amount: 10, description: 'Movimiento viejo', accountId: 'viejo', categoryId: null, createdAt: 1, updatedAt: 1 }],
    });
    const user = await renderApp();

    await openSettings(user);
    await user.click(screen.getByRole('button', { name: /Respaldo de datos/ }));
    await screen.findByText('Respaldo de datos');

    const payload = buildExportPayload(incoming);
    const file = new File([JSON.stringify(payload)], 'hilo-respaldo.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // aparece el paso de confirmación de restauración
    await user.click(await screen.findByRole('button', { name: 'Sí, restaurar' }));

    expect(await screen.findByText('Respaldo restaurado')).toBeInTheDocument();

    await gotoTab(user, 'Cuentas');
    expect(await screen.findByText('Cuenta Importada')).toBeInTheDocument();
    expect(screen.queryByText('Cuenta Vieja')).not.toBeInTheDocument();
  });
});
