/* La hoja de respaldo por su container, con las capacidades del navegador
   fingidas: se puede bajar el archivo, romper el portapapeles y leer un
   respaldo sin tener ninguna de las tres.

   El caso que más importa es el que separa a `backup` de `sync`: leer no
   aplica. Entre el archivo y el reemplazo hay una confirmación, y cancelarla
   tiene que dejar los datos como estaban. */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Account, DataState, Transaction } from '../../../shared/domain/types';
import {
  fakeClipboardGateway, fakeDownloadGateway, fakeFileGateway, fakeGatewayLog, fakeShareGateway,
} from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { buildExportPayload } from '../../sync/domain/payload';
import { BackupContainer } from './containers/BackupContainer';

const local: Account = { id: 'viejo', name: 'Cuenta Vieja', type: 'efectivo', color: '#C9A24B', initialBalance: 50 };
const localTxn: Transaction = {
  id: 'tv', type: 'expense', date: '2026-09-01', amount: 10, description: 'Movimiento viejo',
  accountId: 'viejo', categoryId: 'comida', createdAt: 1, updatedAt: 1,
} as Transaction;

const importada: Account = { id: 'aX', name: 'Cuenta Importada', type: 'debito', color: '#8D5FB0', initialBalance: 0 };
const importadaTxn: Transaction = {
  id: 'txnX', type: 'income', date: '2026-09-02', amount: 999, description: 'Ingreso restaurado',
  accountId: 'aX', categoryId: 'sueldo', createdAt: 2, updatedAt: 2,
} as Transaction;

const respaldo = (): string => JSON.stringify(buildExportPayload({
  accounts: [importada], categories: [], transactions: [importadaTxn], installmentPlans: [], tombstones: [],
} as DataState));

type Opciones = {
  fileContents?: string;
  clipboardFails?: boolean;
};

async function abrirRespaldo(options: Opciones = {}) {
  const log = fakeGatewayLog();
  const rendered = await renderFeature(<BackupContainer />, {
    state: { accounts: [local], transactions: [localTxn] },
    deps: {
      fileGateway: fakeFileGateway(log, options.fileContents ?? respaldo()),
      clipboardGateway: fakeClipboardGateway(log, options.clipboardFails ? new Error('bloqueado') : undefined),
      shareGateway: fakeShareGateway(log),
      downloadGateway: fakeDownloadGateway(log),
    },
  });
  // La hoja se monta cerrada: se abre desde Ajustes.
  rendered.store.getState().setBackupModalOpen(true);
  await screen.findByText('Respaldo de datos');
  return { ...rendered, log };
}

const elegirArchivo = async (user: Awaited<ReturnType<typeof abrirRespaldo>>['user']) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, new File(['da igual'], 'hilo-respaldo.json', { type: 'application/json' }));
};

describe('respaldar', () => {
  it('entrega el payload completo y el nombre fechado al gateway de descarga', async () => {
    const { user, log } = await abrirRespaldo();

    await user.click(screen.getByRole('button', { name: /Respaldar ahora/ }));

    expect(log.downloaded).toHaveLength(1);
    expect(log.downloaded[0]!.fileName).toMatch(/^hilo-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    const payload = log.downloaded[0]!.payload as { partial: boolean; data: { accounts: Account[] } };
    expect(payload.partial).toBe(false);
    expect(payload.data.accounts).toEqual([local]);
  });

  it('copiar deja el texto comprimido en el portapapeles', async () => {
    const { user, log } = await abrirRespaldo();

    await user.click(screen.getByRole('button', { name: /Copiar texto/ }));

    expect(await screen.findByText('Copiado')).toBeInTheDocument();
    expect(log.copied).toHaveLength(1);
    expect(log.copied[0]!.startsWith('hilo1:')).toBe(true);
  });

  it('si el portapapeles no deja, lo dice sin romper', async () => {
    const { user, log } = await abrirRespaldo({ clipboardFails: true });

    await user.click(screen.getByRole('button', { name: /Copiar texto/ }));

    expect(await screen.findByText('No se pudo copiar.')).toBeInTheDocument();
    expect(log.copied).toHaveLength(0);
  });
});

describe('restaurar', () => {
  it('leer el archivo NO aplica nada: solo pide confirmación', async () => {
    const { user, store } = await abrirRespaldo();

    await elegirArchivo(user);

    expect(await screen.findByText(/Se reemplazarán tus 1 movimientos y 1 cuentas/)).toBeInTheDocument();
    expect(screen.getByText(/\(1 movimientos, 1 cuentas\)/)).toBeInTheDocument();
    expect(store.getState().accounts).toEqual([local]);
  });

  it('cancelar deja los datos como estaban y vuelve a ofrecer el archivo', async () => {
    const { user, store } = await abrirRespaldo();
    await elegirArchivo(user);

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(store.getState().accounts).toEqual([local]);
    expect(screen.getByText(/Restaurar desde archivo/)).toBeInTheDocument();
  });

  it('confirmar reemplaza TODO, no funde', async () => {
    const { user, store } = await abrirRespaldo();
    await elegirArchivo(user);

    await user.click(await screen.findByRole('button', { name: 'Sí, restaurar' }));

    const state = store.getState();
    expect(state.accounts).toEqual([importada]);
    expect(state.transactions).toEqual([importadaTxn]);
    expect(state.toast).toBe('Respaldo restaurado');
    // La hoja se cierra sola al restaurar.
    expect(state.backupModalOpen).toBe(false);
  });

  it('un archivo que no es de Hilo se queda en un mensaje, sin tocar los datos', async () => {
    const { user, store } = await abrirRespaldo({ fileContents: '{"app":"otra-cosa"}' });

    await elegirArchivo(user);

    expect(await screen.findByText('Esto no parece un export de Hilo.')).toBeInTheDocument();
    expect(store.getState().accounts).toEqual([local]);
  });

  /* El container va partido en dos justamente por esto: el respaldo a medio
     leer vive en la hoja, que se desmonta al cerrar. */
  it('cerrar con una confirmación a medias no la deja esperando al reabrir', async () => {
    const { user, store } = await abrirRespaldo();
    await elegirArchivo(user);
    await screen.findByRole('button', { name: 'Sí, restaurar' });

    // Cerrar de verdad —con su render— y volver a abrir: si los dos `set`
    // fueran en el mismo tick, React no llegaría a desmontar nada.
    store.getState().setBackupModalOpen(false);
    await waitFor(() => expect(screen.queryByText('Respaldo de datos')).not.toBeInTheDocument());
    store.getState().setBackupModalOpen(true);

    expect(await screen.findByText(/Restaurar desde archivo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sí, restaurar' })).not.toBeInTheDocument();
  });
});
