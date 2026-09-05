/* La hoja de escanear ticket por su container, con el escaneo fingido: sin
   `<canvas>`, sin red y sin API key de verdad.

   Es lo que compra sacar la llamada a la API a un puerto — antes, probar esto
   pedía parchear `fetch` global y el modal seguía necesitando un canvas que
   jsdom no tiene. */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Account, Category } from '../../../shared/domain/types';
import { inMemoryOcrSettingsRepository } from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import type { ReceiptScan } from '../domain/draft';
import { fakeReceiptGateway, fakeReceiptLog } from '../infrastructure/in-memory';
import { ReceiptScanContainer } from './containers/ReceiptScanContainer';

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 500 };
const tarjeta: Account = { id: 'a2', name: 'Tarjeta', type: 'credito', color: '#8D5FB0', initialBalance: 0 };

const comida: Category = { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#111', type: 'expense' };

const ticket: ReceiptScan = {
  store: 'Soriana',
  date: '2026-09-01',
  ticketTotal: 40,
  lineItems: [{ description: 'Leche', listPrice: 45.5, quantity: 2, categoryId: 'comida' }],
  discounts: [{ label: 'Ahorro total', amount: 5.5 }],
};

async function abrirEscaneo(
  { scan = ticket as ReceiptScan | Error, apiKey = 'sk-test' } = {},
) {
  const log = fakeReceiptLog();
  const rendered = await renderFeature(<ReceiptScanContainer />, {
    state: { accounts: [efectivo, tarjeta], categories: [comida] },
    deps: {
      receiptGateway: fakeReceiptGateway(scan, log),
      ocrSettingsRepository: inMemoryOcrSettingsRepository({ initial: { apiKey, model: '' } }),
    },
  });
  rendered.store.getState().setReceiptModalOpen(true);
  await screen.findByText('Escanear ticket');
  return { ...rendered, log };
}

const subirFoto = async (user: Awaited<ReturnType<typeof abrirEscaneo>>['user']) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['foto'], 'ticket.jpg', { type: 'image/jpeg' }));
};

describe('capturar', () => {
  it('sin API key solo ofrece ir a Ajustes', async () => {
    const { user, store } = await abrirEscaneo({ apiKey: '' });

    expect(screen.queryByText('Seleccionar o tomar foto')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }));

    expect(store.getState().settingsOpen).toBe(true);
    expect(store.getState().receiptModalOpen).toBe(false);
  });

  it('un fallo de la API se queda en un mensaje, y se puede reintentar', async () => {
    const { user, store } = await abrirEscaneo({ scan: new Error('La clave de API no es válida.') });

    await subirFoto(user);

    expect(await screen.findByText('La clave de API no es válida.')).toBeInTheDocument();
    // Sigue en la pantalla de captura: el input está ahí para volver a intentar.
    expect(screen.getByText('Seleccionar o tomar foto')).toBeInTheDocument();
    expect(store.getState().transactions).toEqual([]);
  });
});

describe('revisar y agregar', () => {
  it('el ticket leído llega a la hoja con sus renglones y su descuento', async () => {
    const { user, log } = await abrirEscaneo();

    await subirFoto(user);

    expect(await screen.findByDisplayValue('Soriana')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Leche')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ahorro total')).toBeInTheDocument();
    // Al modelo solo se le mandan las categorías de GASTO.
    expect(log.scanned[0]!.expenseCategories).toEqual([comida]);
  });

  it('las sumas se enseñan hechas y el neto cuadra con el total del ticket', async () => {
    const { user } = await abrirEscaneo();
    await subirFoto(user);

    await screen.findByText('= Neto');
    // 45.50 de artículos − 5.50 de descuento = 40, el total impreso.
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0);
    expect(screen.queryByText(/no cuadra con el total/)).not.toBeInTheDocument();
  });

  it('confirmar agrega el gasto y el descuento como ingreso', async () => {
    const { user, store } = await abrirEscaneo();
    await subirFoto(user);
    await screen.findByDisplayValue('Leche');

    await user.click(screen.getByRole('button', { name: /Agregar 2 movimientos/ }));

    await waitFor(() => expect(store.getState().transactions).toHaveLength(2));
    const [gasto, ingreso] = store.getState().transactions;
    expect(gasto).toMatchObject({ type: 'expense', amount: 45.5, store: 'Soriana', accountId: 'a1' });
    expect(ingreso).toMatchObject({ type: 'income', amount: 5.5 });
    expect(store.getState().receiptModalOpen).toBe(false);
  });

  it('descartar un renglón lo deja fuera y baja el conteo del botón', async () => {
    const { user, store } = await abrirEscaneo();
    await subirFoto(user);
    await screen.findByDisplayValue('Leche');

    const casillas = screen.getAllByRole('button').filter(b => b.className.includes('w-5 h-5 rounded-md'));
    await user.click(casillas[0]!);

    await user.click(await screen.findByRole('button', { name: /Agregar 1 movimiento$/ }));

    await waitFor(() => expect(store.getState().transactions).toHaveLength(1));
    expect(store.getState().transactions[0]).toMatchObject({ type: 'income', amount: 5.5 });
  });
});
