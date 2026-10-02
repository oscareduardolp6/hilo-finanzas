/* `<input type="date">` que abre el selector nativo al tocarlo.

   En Android (Chrome, y sobre todo la PWA instalada) el toque a veces solo
   "selecciona" el texto de la fecha sin abrir el selector, y como el campo no
   es editable a mano el usuario no puede cambiarla. `showPicker()` abre el
   selector explícitamente desde el gesto del usuario; si el navegador no lo
   tiene o lo rechaza, queda el comportamiento nativo de siempre. Lo comparten
   los cuatro formularios con fecha. */

import type { CSSProperties } from 'react';
import { COLORS } from '../design/tokens';

export type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
};

export function DateInput({ value, onChange, className, style }: DateInputProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          // Sin gesto de usuario o ya abierto: el nativo se encarga.
        }
      }}
      className={className}
      style={{ color: COLORS.text, colorScheme: 'dark', ...style }}
    />
  );
}
