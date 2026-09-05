/* Ajustes por su container. Lo que más importa probar aquí es dónde acaba la
   API key: en su propio repositorio, nunca en el blob de datos. */

import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Transaction } from '../../../shared/domain/types';
import {
  brokenPersistence, inMemoryOcrSettingsRepository, inMemoryStateRepository,
} from '../../../shared/infrastructure/in-memory';
import { renderFeature } from '../../../test/render-feature';
import { SettingsContainer } from './containers/SettingsContainer';

const gasto: Transaction = {
  id: 't1', type: 'expense', date: '2026-09-01', amount: 100, description: 'Tacos',
  accountId: 'a1', categoryId: 'comida', createdAt: 1, updatedAt: 1,
};

async function abrirAjustes({ apiKey = '', ocrFalla = false } = {}) {
  const ocrSettingsRepository = inMemoryOcrSettingsRepository({
    initial: apiKey ? { apiKey, model: '' } : null,
    ...(ocrFalla ? { failWith: brokenPersistence() } : {}),
  });
  const stateRepository = inMemoryStateRepository({
    initial: { accounts: [], categories: [], transactions: [gasto], installmentPlans: [], tombstones: [] },
  });
  const rendered = await renderFeature(<SettingsContainer />, {
    deps: { ocrSettingsRepository, stateRepository },
  });
  rendered.store.getState().setSettingsOpen(true);
  await screen.findByText('Ajustes');
  return { ...rendered, ocrSettingsRepository, stateRepository };
}

describe('config de escaneo', () => {
  it('la key va a su propio repositorio, nunca al blob de datos', async () => {
    const { user, store, ocrSettingsRepository, stateRepository } = await abrirAjustes();

    await user.type(screen.getByPlaceholderText('sk-ant-...'), 'sk-ant-secreta');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(ocrSettingsRepository.peek()).toEqual({ apiKey: 'sk-ant-secreta', model: '' }));
    expect(store.getState().toast).toBe('Config de escaneo guardada');
    // El blob que viaja en sync / QR / respaldo no la contiene por construcción.
    expect(JSON.stringify(stateRepository.peek())).not.toContain('sk-ant');
  });

  it('quitarla la borra de la config y lo dice', async () => {
    const { user, store, ocrSettingsRepository } = await abrirAjustes({ apiKey: 'sk-ant-vieja' });

    await user.click(screen.getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(store.getState().toast).toBe('API key eliminada'));
    // Guardar una config vacía borra la entrada, no guarda una vacía.
    expect(ocrSettingsRepository.peek()).toBeNull();
  });

  it('si la escritura falla, el toast de error pisa al de éxito', async () => {
    const { user, store } = await abrirAjustes({ ocrFalla: true });

    await user.type(screen.getByPlaceholderText('sk-ant-...'), 'sk-ant-x');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(store.getState().toast).toBe('No se pudo guardar la config de escaneo'));
    // La config sí quedó en efecto en memoria: lo que falló fue persistirla.
    expect(store.getState().ocrSettings.apiKey).toBe('sk-ant-x');
  });
});

describe('abrir otras hojas', () => {
  it.each([
    ['Sincronizar dispositivos', 'syncModalOpen'],
    ['Respaldo de datos', 'backupModalOpen'],
    ['Importar desde Monefy', 'importModalOpen'],
  ] as const)('%s cierra Ajustes y abre la suya', async (boton, campo) => {
    const { user, store } = await abrirAjustes();

    await user.click(screen.getByRole('button', { name: new RegExp(boton) }));

    const state = store.getState();
    expect(state.settingsOpen).toBe(false);
    expect(state[campo]).toBe(true);
  });
});

describe('borrar todos los movimientos', () => {
  it('pide confirmación antes de borrar', async () => {
    const { user, store } = await abrirAjustes();

    await user.click(screen.getByRole('button', { name: 'Borrar todos los movimientos' }));

    expect(await screen.findByText(/¿Seguro\?/)).toBeInTheDocument();
    expect(store.getState().transactions).toEqual([gasto]);

    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));

    await waitFor(() => expect(store.getState().transactions).toEqual([]));
    expect(store.getState().settingsOpen).toBe(false);
  });

  it('cancelar deja los movimientos donde estaban', async () => {
    const { user, store } = await abrirAjustes();
    await user.click(screen.getByRole('button', { name: 'Borrar todos los movimientos' }));

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(store.getState().transactions).toEqual([gasto]);
    expect(screen.getByRole('button', { name: 'Borrar todos los movimientos' })).toBeInTheDocument();
  });
});
