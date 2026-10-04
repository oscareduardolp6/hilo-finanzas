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
  const { user, signIn, signOut, signInError } = useAuth();
  return (
    <div>
      <p>{user ? `Hola ${user.email}` : 'Modo local'}</p>
      <button onClick={signIn}>Entrar</button>
      <button onClick={signOut}>Salir</button>
      {signInError && <p>{signInError}</p>}
    </div>
  );
}

describe('AuthGate', () => {
  it('sin sesión monta a los hijos en modo local (sin pantalla de login); al iniciar sesión les da el usuario', async () => {
    const deps = createDeps({ authGateway: fakeAuthGateway(null) });
    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByText('Modo local')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar sesión con Google/ })).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Entrar' }).click();

    expect(await screen.findByText(/Hola/)).toBeInTheDocument();
  });

  it('ya logueado, monta a los hijos directo, y "signOut" los devuelve al modo local', async () => {
    const deps = createDeps({ authGateway: fakeAuthGateway(USER) });
    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByText('Hola u1@example.com')).toBeInTheDocument();

    screen.getByRole('button', { name: 'Salir' }).click();

    await waitFor(() => {
      expect(screen.getByText('Modo local')).toBeInTheDocument();
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

  it('si el login por redirect falla (PWA instalada), expone el error por contexto en vez de solo la consola', async () => {
    const redirectFailGateway: AuthGateway = {
      signInWithGoogle: async () => {},
      signOut: async () => {},
      onAuthStateChanged: (cb, onError) => {
        cb(null);
        onError?.('Firebase: Error (auth/web-storage-unsupported).');
        return () => {};
      },
    };
    const deps = createDeps({ authGateway: redirectFailGateway });

    render(
      <AuthGate deps={deps}>
        <Hijo />
      </AuthGate>,
    );

    expect(await screen.findByText(/auth\/web-storage-unsupported/)).toBeInTheDocument();
  });
});
