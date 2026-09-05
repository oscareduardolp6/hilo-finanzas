/* Heurísticas para rellenar lo que Monefy no exporta: qué tipo de cuenta es
   cada nombre y qué icono le toca a cada categoría. Son listas de palabras
   clave en español, trasladadas verbatim del legacy — el orden importa, porque
   gana la primera que coincide. */

import type { AccountTypeId } from '../../../shared/domain/types';

const MONEFY_ACCOUNT_TYPE_HINTS: { type: AccountTypeId; keywords: string[] }[] = [
  { type: 'efectivo', keywords: ['efectivo', 'cash'] },
  { type: 'credito', keywords: ['crédito', 'credito', 'tdc'] },
  { type: 'inversion', keywords: ['inversión', 'inversion', 'cetes'] },
  { type: 'ahorro', keywords: ['ahorro', 'apartado', 'fondo'] },
];

export function guessAccountType(name: string): AccountTypeId {
  const lower = name.toLowerCase();
  for (const { type, keywords } of MONEFY_ACCOUNT_TYPE_HINTS) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'debito';
}

const MONEFY_CATEGORY_ICON_HINTS = [
  { icon: 'UtensilsCrossed', keywords: ['comida', 'restaurante', 'súper', 'super', 'snack'] },
  { icon: 'Coffee', keywords: ['cafeter', 'café', 'cafe'] },
  { icon: 'Fuel', keywords: ['gasolina'] },
  { icon: 'Car', keywords: ['coche', 'transporte', 'uber', 'estacionamiento', 'caseta'] },
  { icon: 'Home', keywords: ['renta', 'casa'] },
  { icon: 'HeartPulse', keywords: ['salud', 'enfermedad', 'terapia'] },
  { icon: 'Sparkles', keywords: ['belleza', 'spa', 'higiene'] },
  { icon: 'Film', keywords: ['entretenimiento', 'x box', 'cardistry', 'magia', 'apuesta'] },
  { icon: 'Shirt', keywords: ['ropa'] },
  { icon: 'GraduationCap', keywords: ['escuela', 'educaci', 'beca'] },
  { icon: 'PawPrint', keywords: ['mascota', 'ganado'] },
  { icon: 'Gift', keywords: ['regalo'] },
  { icon: 'ShoppingBag', keywords: ['compra', 'computadora', 'software'] },
  { icon: 'Wallet', keywords: ['sueldo', 'salario', 'prestacion', 'prestación'] },
  { icon: 'Briefcase', keywords: ['trabajo', 'freelance', 'proservicio'] },
  { icon: 'TrendingUp', keywords: ['inversion', 'inversión', 'ahorro', 'financiero', 'banco'] },
  { icon: 'RotateCcw', keywords: ['reembolso', 'descuento', 'devolucion', 'devolución'] },
  { icon: 'Plane', keywords: ['viaje', 'vacacion', 'vacación', 'hospedaje'] },
  { icon: 'Dumbbell', keywords: ['gym', 'deporte', 'alberca'] },
  { icon: 'Wrench', keywords: ['herramienta', 'tramite', 'trámite'] },
  { icon: 'Smartphone', keywords: ['telefon'] },
];

export function guessCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const { icon, keywords } of MONEFY_CATEGORY_ICON_HINTS) {
    if (keywords.some(k => lower.includes(k))) return icon;
  }
  return 'MoreHorizontal';
}
