/* `AuthGate` fuera del store: no hay `renderFeature` que lo cubra (monta
   `HiloStoreProvider` directo). Se prueba aparte, con hijos triviales. */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createDeps } from './dependencies';
import { AuthGate, useAuth } from './auth-context';
import { fakeAuthGateway } from '../shared/infrastructure/in-memory';
import type { AuthGateway } from '../shared/domain/ports';

const USER = { uid: 'u1', email: 'u1@example.com', displayName: 'Uno' };

function Hijo() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <p>Hola {user.email}</p>
      <button onClick={signOut}>Salir</button>
    </div>
  );
}

describe('AuthGate', () => {
  it('sin sesión muestra el login; con sesión monta a los hijos', async () => {
    const deps = createDeps({ authGateway: fakeAuthGateway(null) });
    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByRole('button', { name: /Iniciar sesión con Google/ })).toBeInTheDocument();

    await deps.authGateway.signInWithGoogle();

    expect(await screen.findByText(/Hola/)).toBeInTheDocument();
  });

  it('ya logueado, monta a los hijos directo, y "signOut" corta la sesión', async () => {
    const deps = createDeps({ authGateway: fakeAuthGateway(USER) });
    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByText('Hola u1@example.com')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Salir' }).click();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Iniciar sesión con Google/ })).toBeInTheDocument();
    });
  });

  it('si el gateway de auth truena al suscribirse, muestra un error legible en vez de una pantalla en blanco', async () => {
    const brokenGateway: AuthGateway = {
      signInWithGoogle: async () => {},
      signOut: async () => {},
      onAuthStateChanged: () => {
        throw new Error('Firebase: Error (auth/invalid-api-key).');
      },
    };
    const deps = createDeps({ authGateway: brokenGateway });

    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByText(/No se pudo conectar con Firebase/)).toBeInTheDocument();
  });
});
