import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderApp, gotoTab, seedState } from './helpers.jsx';

const CSV = [
  'date,account,category,amount,currency,converted amount,currency,description',
  '01/03/2024,Nu Bank,Comida,-180.00,MXN,-180.00,MXN,Tacos de importación',
  '02/03/2024,Nu Bank,Salario,5000.00,MXN,5000.00,MXN,Nómina importada',
].join('\n');

describe('Importar desde Monefy (end-to-end por la UI)', () => {
  it('sube el CSV, muestra la revisión y agrega los movimientos', async () => {
    await seedState({ accounts: [{ id: 'acc1', name: 'Local', type: 'efectivo', color: '#C9A24B', initialBalance: 0 }] });
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await user.click(await screen.findByRole('button', { name: 'Importar desde Monefy' }));
    await screen.findByText('Importar desde Monefy');

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File([CSV], 'monefy.csv', { type: 'text/csv' })] } });

    // Revisión
    expect(await screen.findByText('2 movimientos detectados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Importar 2 movimientos/ }));

    // Confirmación final
    await user.click(await screen.findByRole('button', { name: 'Listo' }));
    expect(await screen.findByText(/Se importaron 2 movimientos de Monefy/)).toBeInTheDocument();

    await gotoTab(user, 'Historial');
    // los movimientos importados son de marzo 2024: hay que ver todo el tiempo
    await user.click(screen.getByRole('button', { name: 'Ver todo el tiempo' }));
    expect(await screen.findByText('Tacos de importación')).toBeInTheDocument();
    expect(screen.getByText('Nómina importada')).toBeInTheDocument();

    await gotoTab(user, 'Cuentas');
    expect(await screen.findByText('Nu Bank')).toBeInTheDocument();
  });
});
