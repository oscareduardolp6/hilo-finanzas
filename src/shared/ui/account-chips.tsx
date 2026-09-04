/* Selección de cuenta por chips, con buscador cuando hay muchas.

   `AccountChipSearch` se exporta suelto porque el formulario de movimiento pinta
   sus propias filas de chips (necesita dos, "Desde" y "Hacia", con reglas
   distintas) y solo reutiliza el buscador. Cada call site decide cuándo
   mostrarlo — ver `ACCOUNT_SEARCH_THRESHOLD`. */

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { ACCOUNT_SEARCH_THRESHOLD, COLORS } from '../design/tokens';
import { accountNameMatches } from '../domain/search';
import type { Account } from '../domain/types';

export type AccountChipSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AccountChipSearch({ value, onChange }: AccountChipSearchProps) {
  return (
    <div className="relative mb-2">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: COLORS.textFaint }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Buscar cuenta"
        className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs outline-none"
        style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: COLORS.textFaint }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export type AccountChipsProps = {
  accounts: Account[];
  value: string | null;
  onSelect: (id: string) => void;
};

/** Fila completa de chips. La usa `ReceiptScanModal` (cuenta principal / origen). */
export function AccountChips({ accounts, value, onSelect }: AccountChipsProps) {
  const [q, setQ] = useState('');
  const list = accounts.filter(a => accountNameMatches(a.name, q));
  return (
    <div>
      {accounts.length > ACCOUNT_SEARCH_THRESHOLD && <AccountChipSearch value={q} onChange={setQ} />}
      <div className="flex gap-2 overflow-x-auto hilo-scroll pb-1">
        {list.map(a => {
          const isSel = value === a.id;
          return (
            <button key={a.id} type="button" onClick={() => onSelect(a.id)} className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium" style={{ borderColor: isSel ? a.color : COLORS.border, backgroundColor: isSel ? a.color + '22' : 'transparent', color: COLORS.text }}>
              {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
