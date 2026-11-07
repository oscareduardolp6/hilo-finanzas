/* La hoja de escanear ticket por su container, con el escaneo fingido: sin
   `<canvas>`, sin red y sin API key de verdad.

   Es lo que compra sacar la llamada a la API a un puerto — antes, probar esto
   pedía parchear `fetch` global y el modal seguía necesitando un canvas que
   jsdom no tiene. */

import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Account, Category } from '../../../shared/domain/types';
import { inMemoryOcrSettingsRepository } from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { MAX_RECEIPT_PHOTOS } from '../domain/config';
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
  lineItems: [{ description: 'Leche', listPrice: 45.5, quantity: 2, unitPrice: 22.75, categoryId: 'comida' }],
  discounts: [{ label: 'Ahorro total', amount: 5.5 }],
};

// jsdom no trae `URL.createObjectURL`, y las miniaturas lo usan.
const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
beforeAll(() => {
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
});
afterAll(() => {
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
});

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

type User = Awaited<ReturnType<typeof abrirEscaneo>>['user'];
const foto = (name: string) => new File(['foto'], name, { type: 'image/jpeg' });

const tomarFoto = (user: User, name = 'ticket.jpg') =>
  user.upload(screen.getByTestId('receipt-camera') as HTMLInputElement, foto(name));
const elegirDeGaleria = (user: User, ...names: string[]) =>
  user.upload(screen.getByTestId('receipt-gallery') as HTMLInputElement, names.map(foto));

describe('capturar', () => {
  it('sin API key solo ofrece ir a Ajustes', async () => {
    const { user, store } = await abrirEscaneo({ apiKey: '' });

    expect(screen.queryByText('Tomar foto')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }));

    expect(store.getState().settingsOpen).toBe(true);
    expect(store.getState().receiptModalOpen).toBe(false);
  });

  it('la cámara y la galería son dos entradas: solo la cámara fuerza `capture`', async () => {
    await abrirEscaneo();

    expect(screen.getByTestId('receipt-camera')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('receipt-gallery')).not.toHaveAttribute('capture');
    expect(screen.getByTestId('receipt-gallery')).toHaveAttribute('multiple');
  });

  it('las fotos se acumulan en orden, se pueden quitar, y van todas en un solo escaneo', async () => {
    const { user, log } = await abrirEscaneo();

    await tomarFoto(user, 'arriba.jpg');
    await elegirDeGaleria(user, 'medio.jpg', 'abajo.jpg', 'sobra.jpg');
    expect(screen.getAllByRole('img')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'Quitar foto 4' }));
    await user.click(screen.getByRole('button', { name: 'Leer ticket (3 fotos)' }));

    await waitFor(() => expect(log.scanned).toHaveLength(1));
    expect(log.prepared).toEqual(['arriba.jpg', 'medio.jpg', 'abajo.jpg']);
    expect(log.scanned[0]!.images.map(i => atob(i.data))).toEqual(['arriba.jpg', 'medio.jpg', 'abajo.jpg']);
    // Al modelo solo se le mandan las categorías de GASTO.
    expect(log.scanned[0]!.expenseCategories).toEqual([comida]);
  });

  it(`no pasa de ${MAX_RECEIPT_PHOTOS} fotos`, async () => {
    const { user } = await abrirEscaneo();

    await elegirDeGaleria(user, ...Array.from({ length: MAX_RECEIPT_PHOTOS + 2 }, (_, i) => `f${i}.jpg`));

    expect(screen.getAllByRole('img')).toHaveLength(MAX_RECEIPT_PHOTOS);
    expect(screen.getByText(`Máximo ${MAX_RECEIPT_PHOTOS} fotos por ticket.`)).toBeInTheDocument();
  });

  it('un fallo de la API se queda en un mensaje, con las fotos, y ofrece ir a Ajustes', async () => {
    const { user, store } = await abrirEscaneo({ scan: new Error('La clave de API no es válida.') });

    await tomarFoto(user);
    await user.click(screen.getByRole('button', { name: 'Leer ticket' }));

    expect(await screen.findByText('La clave de API no es válida.')).toBeInTheDocument();
    // Sigue en la captura con la foto: se reintenta sin volver a tomarla.
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Leer ticket' })).toBeEnabled();
    expect(store.getState().sheetOpen).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Ir a Ajustes' }));
    expect(store.getState().settingsOpen).toBe(true);
  });
});

describe('del ticket al formulario', () => {
  it('leer el ticket cierra la hoja y abre el formulario de movimiento con el desglose', async () => {
    const { user, store } = await abrirEscaneo();

    await tomarFoto(user);
    await user.click(screen.getByRole('button', { name: 'Leer ticket' }));

    await waitFor(() => expect(store.getState().sheetOpen).toBe(true));
    const s = store.getState();
    expect(s.receiptModalOpen).toBe(false);
    expect(s.formType).toBe('expense');
    expect(s.editingId).toBeNull();
    expect(s.form).toMatchObject({
      // Lo pagado es el total impreso; el descuento no es un ingreso aparte.
      amount: '40', store: 'Soriana', date: '2026-09-01', categoryId: 'comida', accountId: 'a1',
      breakdown: {
        items: [{ description: 'Leche', amount: '45.5', quantity: '2', unitPrice: '22.75', categoryId: null }],
        discounts: [{ label: 'Ahorro total', amount: '5.5', categoryId: null, benefitProgramId: null }],
      },
    });
    // Escanear no guarda nada: eso es del formulario.
    expect(s.transactions).toEqual([]);
  });
});
