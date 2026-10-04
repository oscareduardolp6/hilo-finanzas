/* Modo local: sin sesión de Google la app arranca igual, con los datos del
   IndexedDB de este navegador, y nunca toca la nube. Montado como App completa
   (no `renderFeature`) porque lo que se prueba es justo el cableado de
   `SessionStore`: qué repositorio usa el store según haya o no sesión. */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createDeps } from './dependencies';
import { fakeAuthGateway, inMemoryStateRepository } from '../shared/infrastructure/in-memory';
import type { DataState } from '../shared/domain/types';

const stateWith = (accountName: string): DataState => ({
  accounts: [{ id: 'a1', name: accountName, type: 'efectivo', color: '#C9A24B', initialBalance: 100 }],
  categories: [],
  transactions: [],
  installmentPlans: [],
  tombstones: [],
  benefitPrograms: [],
});

describe('modo local (sin sesión)', () => {
  it('muestra la app con los datos locales, sin pantalla de login ni tocar la nube; al iniciar sesión pasa a los datos de la nube', async () => {
    const cloud = inMemoryStateRepository({ initial: stateWith('Cuenta de la nube') });
    const local = inMemoryStateRepository({ initial: stateWith('Cuenta local') });
    const deps = createDeps({
      stateRepository: cloud,
      legacyLocalStateRepository: local,
      authGateway: fakeAuthGateway(null),
    });
    const user = userEvent.setup();

    render(<App deps={deps} />);

    expect(await screen.findAllByText('Cuenta local')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Iniciar sesión con Google/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Cuenta de la nube')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await user.click(await screen.findByRole('button', { name: /Iniciar sesión con Google/ }));

    expect(await screen.findAllByText('Cuenta de la nube')).not.toHaveLength(0);
    expect(screen.queryByText('Cuenta local')).not.toBeInTheDocument();
  });
});
