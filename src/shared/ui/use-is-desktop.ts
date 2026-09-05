/* Si toca montar el árbol de escritorio o el móvil. Es un `matchMedia`, no un
   listener de `resize`: solo notifica al cruzar el umbral.

   El valor inicial se lee de `window.innerWidth` para que el primer render ya
   sea el correcto y no haya un parpadeo del árbol equivocado. */

import { useEffect, useState } from 'react';
import { DESKTOP_BREAKPOINT } from '../design/tokens';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}
