/* Implementación real de `AuthGateway`, sobre Firebase Auth.

   `signInWithPopup` en el navegador normal, `signInWithRedirect` solo en la
   PWA instalada (modo standalone). No es una preferencia estética: probado
   en vivo, `signInWithRedirect` se queda pegado en la pantalla de login sin
   ningún error — el selector de cuenta de Google se abre bien, pero el
   regreso a la app nunca trae usuario. Causa: `signInWithRedirect` depende de
   un viaje ida-vuelta por `authDomain` (`<proyecto>.firebaseapp.com`) que usa
   storage de terceros para reconectar el resultado con el origen de la app;
   Chrome lo bloquea cada vez más agresivamente (third-party storage
   partitioning) y eso rompe el login en silencio. `signInWithPopup` no tiene
   ese problema — la ventana emergente habla directo con `window.opener` — así
   que es el default. Se conserva `signInWithRedirect` únicamente para modo
   standalone porque ahí sí es el popup el que falla (ver README.md /
   tasks/pwa-install.md). */

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { AuthGateway, AuthUser } from '../domain/ports';
import { auth, googleProvider } from './firebase';

const toAuthUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
});

let redirectChecked = false;
function ensureRedirectChecked(onError?: (message: string) => void): void {
  if (redirectChecked) return;
  redirectChecked = true;
  void getRedirectResult(auth()).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Error al completar el login con Google:', e);
    onError?.(e instanceof Error ? e.message : String(e));
  });
}

const isStandalonePwa = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

export const browserAuthGateway: AuthGateway = {
  signInWithGoogle: async () => {
    if (isStandalonePwa()) {
      await signInWithRedirect(auth(), googleProvider);
    } else {
      await signInWithPopup(auth(), googleProvider);
    }
  },
  signOut: () => firebaseSignOut(auth()),
  onAuthStateChanged: (cb, onError) => {
    ensureRedirectChecked(onError);
    return onAuthStateChanged(auth(), (user) => cb(user ? toAuthUser(user) : null));
  },
};
