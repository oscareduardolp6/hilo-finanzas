/* Inicialización del SDK de Firebase. La config (`VITE_FIREBASE_*`) no es
   secreta — identifica el proyecto, no autoriza nada; lo que protege los
   datos son las Firestore Security Rules (`firestore.rules`), no ocultar
   estos valores. Ver la sección "Configurar tu propio proyecto de Firebase"
   en README.md.

   `auth()`/`db()` son perezosos a propósito: en test, `Deps.stateRepository`
   y `Deps.authGateway` siempre se sobreescriben por un doble en memoria antes
   de usarse (`createDeps`/`renderFeature`), así que el SDK real nunca debería
   inicializarse ahí — inicializarlo de todas formas en cada uno de los ~45
   archivos de test (cada uno con su propio grafo de módulos, ver
   `vitest.config`) era caro y desestabilizaba la suite bajo ejecución
   paralela. Con getters perezosos, importar este archivo no cuesta nada; solo
   `browserAuthGateway`/`firestoreStateRepository` — que ningún test real
   invoca — lo disparan. */

import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

let firebaseApp: FirebaseApp | null = null;
function app(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }
  return firebaseApp;
}

let authInstance: Auth | null = null;
export function auth(): Auth {
  if (!authInstance) authInstance = getAuth(app());
  return authInstance;
}

let dbInstance: Firestore | null = null;
export function db(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(app());
  return dbInstance;
}

/** Instanciar el provider no toca el SDK (sin red, sin `getAuth`): a
 *  diferencia de `auth()`/`db()`, este puede quedarse eager. */
export const googleProvider = new GoogleAuthProvider();
