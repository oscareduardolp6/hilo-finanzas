import { useEffect } from 'react';
import { useHiloStore, useHiloStoreApi } from './store-context';

/** Los toasts se esconden solos a los 2200 ms.
 *
 *  Sigue siendo un efecto de React y no una suscripción del store porque es
 *  puro asunto de UI (un temporizador atado al ciclo de vida del componente) y
 *  porque así conserva exactamente la semántica del `useEffect` original: cada
 *  toast nuevo cancela el temporizador del anterior. */
export const TOAST_MS = 2200;

export function useToastAutoDismiss(): void {
  const store = useHiloStoreApi();
  const toast = useHiloStore((state) => state.toast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => store.getState().setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, store]);
}
