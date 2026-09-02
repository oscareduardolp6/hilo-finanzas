import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderApp, gotoTab, seedState } from './helpers.jsx';
import { saveOcrSettings } from '../../hilo-finanzas.jsx';

/* El escaneo real llama a la API de Anthropic; aquí se mockea `fetch`. También
   se stubbean Image / URL.createObjectURL porque jsdom no decodifica imágenes
   (downscaleImage se quedaría colgado esperando img.onload/onerror). */

const SCAN = {
  store: 'HEB',
  date: '2026-03-01',
  currency: 'MXN',
  lineItems: [
    { description: 'Leche entera', listPrice: 45, quantity: 1, categoryId: 'comida' },
    { description: 'Pan de caja', listPrice: 30, quantity: 2, categoryId: 'comida' },
  ],
  discounts: [{ label: 'Ahorro total', amount: 5 }],
  ticketTotal: 70,
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ content: [{ type: 'tool_use', name: 'emit_receipt', input: SCAN }] }),
  })));
  class FakeImage {
    set src(v) { this._src = v; setTimeout(() => this.onerror && this.onerror(new Event('error')), 0); }
    get src() { return this._src; }
  }
  vi.stubGlobal('Image', FakeImage);
  if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:fake';
  if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('Escanear ticket (end-to-end por la UI)', () => {
  it('foto -> revisión -> confirmar agrega los renglones y el descuento como ingreso', async () => {
    await seedState({
      accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000 }],
      categories: [{ id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' }],
    });
    await saveOcrSettings({ apiKey: 'sk-test', model: '' });
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Escanear ticket' }));
    await screen.findByText('Escanear ticket'); // título del modal

    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['\xFF\xD8\xFF'], 'ticket.jpg', { type: 'image/jpeg' })] } });

    // Revisión: aparecen los renglones detectados
    expect(await screen.findByDisplayValue('Leche entera')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pan de caja')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Agregar 3 movimientos/ }));

    expect(await screen.findByText(/3 movimientos agregados desde el ticket/)).toBeInTheDocument();

    await gotoTab(user, 'Historial');
    await user.click(screen.getByRole('button', { name: 'Ver todo el tiempo' }));
    expect(await screen.findByText('Leche entera')).toBeInTheDocument();
    // el descuento entra como ingreso en la categoría "Descuentos" (creada al vuelo)
    expect(await screen.findByText('Ahorro total')).toBeInTheDocument();
  });
});
