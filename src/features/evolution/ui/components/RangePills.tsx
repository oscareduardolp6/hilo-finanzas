/* El selector de plazos (1M … Todo). Componente de RENDERIZADO. */

import { COLORS } from '../../../../shared/design/tokens';
import { EVOLUTION_RANGES } from '../../domain/series';
import type { EvolutionRangeId } from '../../domain/series';

export type RangePillsProps = {
  value: EvolutionRangeId;
  onChange: (id: EvolutionRangeId) => void;
};

export function RangePills({ value, onChange }: RangePillsProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto hilo-scroll" role="group" aria-label="Plazo">
      {EVOLUTION_RANGES.map((r) => {
        const active = r.id === value;
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            aria-pressed={active}
            className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
            style={{
              backgroundColor: active ? COLORS.accent : COLORS.surfaceAlt,
              color: active ? COLORS.bg : COLORS.textMuted,
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
