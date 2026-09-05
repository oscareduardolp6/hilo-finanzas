/* La hoja de sincronizar por su container, con las capacidades del navegador
   fingidas. Es lo que compra sacarlas a puertos: aquí se puede negar la cámara,
   romper el portapapeles y leer un archivo sin tener ninguna de las tres. */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Account, SyncState } from '../../../shared/domain/types';
import {
  fakeClipboardGateway, fakeDownloadGateway, fakeFileGateway, fakeGatewayLog,
  fakeQrGateway, fakeShareGateway, inMemorySyncStateRepository,
} from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { SyncContainer } from './containers/SyncContainer';

const efectivo: Account = { id: 'a1', name: 'Efectivo', type: 'efectivo', color: '#3F9C8B', initialBalance: 100 };

const soloYo: SyncState = { deviceId: 'yo', deviceName: 'Laptop', peers: {} };

const conPeer: SyncState = {
  deviceId: 'yo',
  deviceName: 'Laptop',
  peers: { tel: { name: 'Teléfono', lastSentAt: 1_600_000_000_000, lastReceivedAt: null } },
};

const payloadDe = (accounts: Account[], device: { id: string; name: string } | null = null) =>
  JSON.stringify({
    app: 'hilo-finanzas', schema: 1, exportedAt: '2026-09-01T10:00:00.000Z',
    device, partial: false, since: null,
    data: { accounts, categories: [], transactions: [], installmentPlans: [], tombstones: [] },
  });

type Opciones = {
  syncState?: SyncState;
  log?: ReturnType<typeof fakeGatewayLog>;
  fileContents?: string;
  clipboardFails?: boolean;
  scanResult?: Uint8Array | Error;
  canShare?: boolean;
};

async function abrirSync(options: Opciones = {}) {
  const log = options.log ?? fakeGatewayLog();
  const rendered = await renderFeature(<SyncContainer />, {
    state: { accounts: [efectivo] },
    deps: {
      syncStateRepository: inMemorySyncStateRepository({ initial: options.syncState ?? soloYo }),
      fileGateway: fakeFileGateway(log, options.fileContents ?? ''),
      clipboardGateway: fakeClipboardGateway(log, options.clipboardFails ? new Error('bloqueado') : undefined),
      shareGateway: fakeShareGateway(log, { canShare: options.canShare ?? true }),
      downloadGateway: fakeDownloadGateway(log),
      qrGateway: fakeQrGateway(options.scanResult),
    },
  });
  // El modal se monta cerrado: la hoja se abre desde Ajustes.
  rendered.store.getState().setSyncModalOpen(true);
  await screen.findByText('Sincronizar dispositivos');
  return { ...rendered, log };
}

const irA = async (user: Awaited<ReturnType<typeof abrirSync>>['user'], tab: string) => {
  await user.click(screen.getByRole('button', { name: tab }));
};

describe('enviar', () => {
  it('prepara el payload y pinta el QR que devuelve el gateway', async () => {
    await abrirSync();

    const qr = await screen.findByAltText('Código QR con tus datos');
    expect(qr.getAttribute('src')).toMatch(/^data:image\/png;base64,qr-de-\d+-bytes$/);
  });

  it('descargar entrega el payload completo al gateway', async () => {
    const { user, log } = await abrirSync();
    await screen.findByAltText('Código QR con tus datos');

    await user.click(screen.getByRole('button', { name: /Descargar archivo/ }));

    expect(log.downloaded).toHaveLength(1);
    expect(log.downloaded[0]!.fileName).toMatch(/^hilo-sync-\d{4}-\d{2}-\d{2}\.json$/);
    expect((log.downloaded[0]!.payload as { data: { accounts: Account[] } }).data.accounts)
      .toEqual([efectivo]);
  });

  it('copiar manda el texto comprimido, con su prefijo', async () => {
    const { user, log } = await abrirSync();
    await screen.findByRole('button', { name: /Copiar texto/ });

    await user.click(screen.getByRole('button', { name: /Copiar texto/ }));

    await waitFor(() => expect(log.copied).toHaveLength(1));
    expect(log.copied[0]).toMatch(/^hilo1:/);
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
  });

  it('si el portapapeles está bloqueado lo dice en la hoja, sin cerrarla', async () => {
    const { user } = await abrirSync({ clipboardFails: true });
    await screen.findByRole('button', { name: /Copiar texto/ });

    await user.click(screen.getByRole('button', { name: /Copiar texto/ }));

    expect(await screen.findByText('El navegador no dejó copiar. Usa el archivo.')).toBeInTheDocument();
    expect(screen.getByText('Sincronizar dispositivos')).toBeInTheDocument();
  });

  it('sin soporte de compartir no ofrece el botón', async () => {
    await abrirSync({ canShare: false });
    await screen.findByAltText('Código QR con tus datos');

    expect(screen.queryByRole('button', { name: /Compartir/ })).not.toBeInTheDocument();
  });

  it('con un punto ya marcado ofrece mandar solo lo nuevo', async () => {
    await abrirSync({ syncState: conPeer });

    expect(await screen.findByRole('button', { name: 'Solo cambios recientes' })).toBeInTheDocument();
    // El botón sale con el estado de sync (inmediato); el resumen espera a que
    // el payload esté preparado, que es asíncrono.
    expect(await screen.findByText(/Solo lo nuevo desde/)).toBeInTheDocument();
  });

  it('sin punto marcado no hay nada que recortar', async () => {
    await abrirSync();
    await screen.findByAltText('Código QR con tus datos');

    expect(screen.queryByRole('button', { name: 'Solo cambios recientes' })).not.toBeInTheDocument();
  });
});

describe('recibir', () => {
  it('un texto válido se funde y cierra la hoja', async () => {
    const nueva: Account = { ...efectivo, id: 'a2', name: 'Banco' };
    const { user, store } = await abrirSync();
    await irA(user, 'Recibir');

    await user.click(screen.getByPlaceholderText('…o pega aquí el texto que copiaste'));
    await user.paste(payloadDe([nueva]));
    await user.click(screen.getByRole('button', { name: /Combinar/ }));

    await waitFor(() => expect(store.getState().syncModalOpen).toBe(false));
    expect(store.getState().accounts.map(a => a.name).sort()).toEqual(['Banco', 'Efectivo']);
  });

  it('un texto que no es de Hilo deja el error a la vista y NO cierra', async () => {
    // El mensaje habla del texto que se acaba de pegar, así que va debajo de él
    // y no en un toast que taparía la hoja.
    const { user, store } = await abrirSync();
    await irA(user, 'Recibir');

    await user.click(screen.getByPlaceholderText('…o pega aquí el texto que copiaste'));
    await user.paste('hola');
    await user.click(screen.getByRole('button', { name: /Combinar/ }));

    expect(await screen.findByText('Esto no parece un export de Hilo.')).toBeInTheDocument();
    expect(store.getState().syncModalOpen).toBe(true);
    expect(store.getState().toast).toBeNull();
  });

  it('un archivo pasa por el gateway de archivos', async () => {
    const nueva: Account = { ...efectivo, id: 'a3', name: 'Nómina' };
    const { user, store, log } = await abrirSync({ fileContents: payloadDe([nueva]) });
    await irA(user, 'Recibir');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['{}'], 'hilo.json', { type: 'application/json' }));

    await waitFor(() => expect(store.getState().accounts).toHaveLength(2));
    expect(log.filesRead).toHaveLength(1);
    expect(store.getState().accounts.map(a => a.name)).toContain('Nómina');
  });

  it('si la cámara falla, el mensaje del gateway sale junto al botón', async () => {
    const { user } = await abrirSync({ scanResult: new Error('Permiso de cámara denegado. Usa archivo o texto.') });
    await irA(user, 'Recibir');

    await user.click(screen.getByRole('button', { name: /Escanear QR/ }));

    expect(await screen.findByText('Permiso de cámara denegado. Usa archivo o texto.')).toBeInTheDocument();
  });
});

describe('dispositivos', () => {
  it('renombrar este dispositivo', async () => {
    const { user, store } = await abrirSync();
    await irA(user, 'Dispositivos');

    const input = screen.getByDisplayValue('Laptop');
    await user.clear(input);
    await user.type(input, 'Escritorio');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(store.getState().syncState!.deviceName).toBe('Escritorio');
  });

  it('sin peers lo dice en vez de listar nada', async () => {
    const { user } = await abrirSync();
    await irA(user, 'Dispositivos');

    expect(screen.getByText('Aún no has recibido de otro dispositivo.')).toBeInTheDocument();
  });

  it('reiniciar el punto pide confirmación', async () => {
    const { user, store } = await abrirSync({ syncState: conPeer });
    await irA(user, 'Dispositivos');

    await user.click(screen.getByRole('button', { name: /Reiniciar punto/ }));
    expect(store.getState().syncState!.peers['tel']).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(store.getState().syncState!.peers['tel']).toBeUndefined();
  });
});
