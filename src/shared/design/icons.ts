/* Catálogo de iconos. Las categorías guardan el NOMBRE del icono (string), no
   el componente, para que el dato sea serializable a IndexedDB y a los payloads
   de sync; `IconFor` hace el lookup en render. */

import {
  UtensilsCrossed, Car, Home, Zap, HeartPulse, Sparkles, Film, Shirt, GraduationCap,
  PawPrint, Gift, ShoppingBag, MoreHorizontal, Wallet, Briefcase, TrendingUp, RotateCcw,
  Music, Plane, Coffee, Dumbbell, Book, Wrench, Smartphone, Baby, Star, Umbrella, Fuel, Ticket,
  Banknote, Landmark, CreditCard, PiggyBank, Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AccountTypeId } from '../domain/types';

export const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, Car, Home, Zap, HeartPulse, Sparkles, Film, Shirt, GraduationCap,
  PawPrint, Gift, ShoppingBag, MoreHorizontal, Wallet, Briefcase, TrendingUp, RotateCcw,
  Music, Plane, Coffee, Dumbbell, Book, Wrench, Smartphone, Baby, Star, Umbrella, Fuel, Ticket,
};

export const ICON_CHOICES: string[] = Object.keys(ICONS);

/** Lookup tolerante: un icono desconocido (dato viejo) cae a `MoreHorizontal`. */
export function IconFor(name: string | null | undefined): LucideIcon {
  return (name ? ICONS[name] : undefined) || MoreHorizontal;
}

export type AccountTypeOption = {
  id: AccountTypeId;
  label: string;
  icon: LucideIcon;
};

export const ACCOUNT_TYPES: AccountTypeOption[] = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'debito', label: 'Débito / Cuenta', icon: Landmark },
  { id: 'credito', label: 'Tarjeta de crédito', icon: CreditCard },
  { id: 'ahorro', label: 'Ahorro', icon: PiggyBank },
  { id: 'inversion', label: 'Inversión', icon: TrendingUp },
  { id: 'otro', label: 'Otro', icon: Coins },
];
