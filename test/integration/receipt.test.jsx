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
    json: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(SCAN) }] }),
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
  it('foto -> formulario lleno con el desglose -> agregar guarda UN movimiento por lo pagado', async () => {
    await seedState({
      accounts: [{ id: 'acc1', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 1000 }],
      categories: [{ id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F', type: 'expense' }],
    });
    await saveOcrSettings({ apiKey: 'sk-test', model: '' });
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Escanear ticket' }));
    await screen.findByText('Escanear ticket'); // título del modal

    const input = document.querySelector('input[type="file"][multiple]');
    fireEvent.change(input, { target: { files: [new File(['\xFF\xD8\xFF'], 'ticket.jpg', { type: 'image/jpeg' })] } });
    await user.click(await screen.findByRole('button', { name: /Leer ticket/ }));

    // El formulario de movimiento, ya lleno: lo pagado, la tienda y el desglose.
    expect(await screen.findByText('Desglosar ticket')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(70);
    expect(screen.getAllByText('Leche entera').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    await gotoTab(user, 'Historial');
    await user.click(screen.getByRole('button', { name: 'Ver todo el tiempo' }));
    // Una sola fila, con sus dos conceptos y el descuento como ahorro (no
    // como ingreso aparte).
    expect(await screen.findByText(/Desglose · 2 conceptos/)).toBeInTheDocument();
    expect(screen.getByText(/Ahorro \$5\.00/)).toBeInTheDocument();
    expect(screen.queryByText('Ahorro total')).not.toBeInTheDocument();
  });
});
