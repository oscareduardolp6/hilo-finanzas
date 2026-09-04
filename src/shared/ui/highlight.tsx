import type { ReactNode } from 'react';
import { COLORS } from '../design/tokens';

/* Vive en `shared/ui` y no en `shared/domain` porque devuelve JSX: era una de
   las fugas de capa del archivo único (ver agents/plans/layered-architecture.md §9).

   Resaltado best-effort: insensible a mayúsculas pero SENSIBLE a acentos, con
   `indexOf` sobre el string original (normalizar a NFD correría los índices). Si
   la coincidencia vino solo por insensibilidad a acentos o por el nombre del
   plan MSI vinculado, simplemente se pinta el texto plano. */
export function highlightMatch(text: unknown, rawQuery: string | null | undefined): ReactNode {
  const str = text == null ? '' : String(text);
  const q = (rawQuery || '').trim();
  if (!q) return str;
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return str;
  return [
    str.slice(0, idx),
    <mark
      key="hl"
      style={{ backgroundColor: COLORS.accentSoft, color: COLORS.text, borderRadius: 3, padding: '0 1px' }}
    >
      {str.slice(idx, idx + q.length)}
    </mark>,
    str.slice(idx + q.length),
  ];
}
