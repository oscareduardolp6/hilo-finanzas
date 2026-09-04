/* Tokens de diseño. Tema oscuro único; los componentes los consumen como
   estilos inline (el resto del estilado es Tailwind). */

export const COLORS = {
  bg: '#0F1A17',
  surface: '#16221D',
  surfaceAlt: '#1D2C25',
  elevated: '#24352C',
  border: 'rgba(243,241,234,0.09)',
  borderStrong: 'rgba(243,241,234,0.16)',
  text: '#F3F1EA',
  textMuted: '#96A69D',
  textFaint: '#69796F',
  accent: '#C9A24B',
  accentSoft: 'rgba(201,162,75,0.16)',
  income: '#5FD9A5',
  incomeSoft: 'rgba(95,217,165,0.14)',
  expense: '#FF7A6E',
  expenseSoft: 'rgba(255,122,110,0.14)',
} as const;

/** Colores ofrecidos al crear una categoría o una cuenta. */
export const CATEGORY_PALETTE = [
  '#E0793F', '#4A7FC4', '#8D6E63', '#C9A24B', '#C4574F', '#C97FB0',
  '#7B6FB0', '#3F9C8B', '#5C8A5C', '#4FA8A0', '#8D5FB0', '#8A9490',
];

/** A partir de este número de cuentas, los chips muestran buscador por nombre
 *  para no scrollear la fila a ciegas. Ver `AccountChipSearch`. */
export const ACCOUNT_SEARCH_THRESHOLD = 5;

/** Tailwind `lg`: a partir de aquí se monta el árbol de escritorio. */
export const DESKTOP_BREAKPOINT = 1024;
