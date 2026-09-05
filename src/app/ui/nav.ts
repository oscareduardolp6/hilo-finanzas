/* Las cuatro pestañas. Viven en `app/` y no en una feature porque la navegación
   es del cascarón: la barra inferior de móvil y la lateral de escritorio pintan
   exactamente la misma lista. */

import { Landmark, Layers, LayoutGrid, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Inicio', icon: LayoutGrid },
  { id: 'history', label: 'Historial', icon: Receipt },
  { id: 'msi', label: 'MSI', icon: Layers },
  { id: 'accounts', label: 'Cuentas', icon: Landmark },
];

/** El título que lleva cada pestaña en el árbol de escritorio. */
export const TAB_TITLES: Record<string, string> = {
  home: 'Inicio',
  history: 'Historial',
  msi: 'Compras a meses',
  accounts: 'Cuentas',
};
