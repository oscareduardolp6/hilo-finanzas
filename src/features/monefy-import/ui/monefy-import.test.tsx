/* La hoja de importar por su container: subir → revisar → importar → listo.

   Con el archivo entrando por el gateway, el test escribe el CSV y no toca un
   `FileReader`. Lo que se prueba es lo que la hoja decide —qué cuentas entran,
   si se usa la convención de Oscar— y que nada llegue al store hasta el último
   botón. */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Account } from '../../../shared/domain/types';
import { fakeFileGateway, fakeGatewayLog } from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { MonefyImportContainer } from './containers/MonefyImportContainer';

const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';

const CSV = [
  HEADER,
  '01/03/2024,Efectivo,Comida,-180.00,MXN,-180.00,MXN,Tacos',
  '02/03/2024,Nu Bank,Salario,5000.00,MXN,5000.00,MXN,Nómina',
].join('\n');

/* Dos pagos de la misma compra a 6: con la convención de Oscar encendida son un
   plan de MSI; apagada, dos gastos sueltos. */
const CSV_MSI = [
  HEADER,
  '01/03/2024,Efectivo,Compras,-150.00,MXN,-150.00,MXN,Audífonos (1/6) - Walmart',
  '15/03/2024,Efectivo,Compras,-150.00,MXN,-150.00,MXN,Audífonos (2/6) - Walmart',
].join('\n');

const local: Account = { id: 'local', name: 'Local', type: 'efectivo', color: '#C9A24B', initialBalance: 0 };

async function abrirImport(contents = CSV) {
  const log = fakeGatewayLog();
  const rendered = await renderFeature(<MonefyImportContainer />, {
    state: { accounts: [local] },
    deps: { fileGateway: fakeFileGateway(log, contents) },
  });
  // La hoja se monta cerrada: se abre desde Ajustes.
  rendered.store.getState().setImportModalOpen(true);
  await screen.findByText('Importar desde Monefy');
  return rendered;
}

const subirCsv = async (user: Awaited<ReturnType<typeof abrirImport>>['user']) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['da igual'], 'monefy.csv', { type: 'text/csv' }));
};

describe('subir el archivo', () => {
  it('pasa a la revisión con lo detectado, sin tocar el store', async () => {
    const { user, store } = await abrirImport();

    await subirCsv(user);

    expect(await screen.findByText('2 movimientos detectados')).toBeInTheDocument();
    // Los nombres son editables: van en un input, no en texto suelto.
    expect(screen.getByDisplayValue('Efectivo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nu Bank')).toBeInTheDocument();
    expect(store.getState().transactions).toEqual([]);
  });

  it('un archivo que no es de Monefy se queda en un mensaje', async () => {
    const { user, store } = await abrirImport('a,b,c\n1,2,3');

    await subirCsv(user);

    expect(await screen.findByText(/no parece un export CSV de Monefy/)).toBeInTheDocument();
    expect(store.getState().accounts).toEqual([local]);
  });
});

describe('importar', () => {
  it('solo el último botón toca el store', async () => {
    const { user, store } = await abrirImport();
    await subirCsv(user);

    await user.click(await screen.findByRole('button', { name: /Importar 2 movimientos/ }));
    // Entre "Importar" y "Listo" el plan ya está hecho pero nada se aplicó.
    await screen.findByText(/Se importaron 2 movimientos/);
    expect(store.getState().transactions).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Listo' }));

    await waitFor(() => expect(store.getState().transactions).toHaveLength(2));
    const state = store.getState();
    expect(state.accounts.map(a => a.name)).toEqual(['Local', 'Efectivo', 'Nu Bank']);
    expect(state.toast).toBe('Se importaron 2 movimientos de Monefy');
    expect(state.importModalOpen).toBe(false);
  });

  it('excluir una cuenta deja fuera sus movimientos', async () => {
    const { user, store } = await abrirImport();
    await subirCsv(user);
    await screen.findByText('2 movimientos detectados');

    // El primer checkbox es el de "Efectivo" (las cuentas van ordenadas).
    const casillas = screen.getAllByRole('button').filter(b => b.className.includes('w-5 h-5 rounded-md'));
    await user.click(casillas[0]!);
    await user.click(screen.getByRole('button', { name: /Importar 2 movimientos/ }));
    await user.click(await screen.findByRole('button', { name: 'Listo' }));

    await waitFor(() => expect(store.getState().transactions).toHaveLength(1));
    expect(store.getState().accounts.map(a => a.name)).toEqual(['Local', 'Nu Bank']);
  });
});

describe('convención de Oscar', () => {
  it('encendida, una serie "(N/D)" se vuelve un plan de MSI', async () => {
    const { user, store } = await abrirImport(CSV_MSI);
    await subirCsv(user);

    expect(await screen.findByText(/1 planes de MSI detectados/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Importar 2 movimientos/ }));
    await user.click(await screen.findByRole('button', { name: 'Listo' }));

    await waitFor(() => expect(store.getState().installmentPlans).toHaveLength(1));
    const plan = store.getState().installmentPlans[0]!;
    expect(plan.description).toBe('Audífonos');
    expect(plan.store).toBe('Walmart');
    // 2 de 6 pagados por $300 ⇒ el plan completo son $900.
    expect(plan.totalAmount).toBe(900);
    expect(plan.installmentsCount).toBe(6);
  });

  it('apagada, los mismos renglones son dos gastos sueltos', async () => {
    const { user, store } = await abrirImport(CSV_MSI);
    await subirCsv(user);
    await screen.findByText('2 movimientos detectados');

    await user.click(screen.getByRole('button', { name: /Usar la convención de Oscar/ }));
    await user.click(screen.getByRole('button', { name: /Importar 2 movimientos/ }));
    await user.click(await screen.findByRole('button', { name: 'Listo' }));

    await waitFor(() => expect(store.getState().transactions).toHaveLength(2));
    expect(store.getState().installmentPlans).toEqual([]);
    // Sin la convención, la descripción entra tal cual la escribió Monefy.
    expect(store.getState().transactions[0]!.description).toBe('Audífonos (1/6) - Walmart');
  });
});
