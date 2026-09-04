/* Campo de tienda con chips de las ya usadas. Lo comparten el formulario de
   movimiento y los dos formularios de plan MSI. */

import { COLORS } from '../design/tokens';

export type StoreInputProps = {
  value: string;
  onChange: (value: string) => void;
  knownStores: string[];
};

export function StoreInput({ value, onChange, knownStores }: StoreInputProps) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Tienda (opcional)</p>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ej. Walmart, HEB, Amazon"
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      />
      {knownStores.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {knownStores.map(s => (
            <button key={s} type="button" onClick={() => onChange(s)} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: value === s ? COLORS.accentSoft : COLORS.surfaceAlt, color: value === s ? COLORS.accent : COLORS.textMuted, border: `1px solid ${value === s ? COLORS.accent : COLORS.border}` }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
