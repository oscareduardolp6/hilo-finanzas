/* La dona de gasto por categoría, con su leyenda. Componente de RENDERIZADO:
   los totales entran ya calculados.

   La leyenda de abajo no es decoración: la dona de recharts necesita medir su
   contenedor, y sus porciones son SVG. La lista son botones normales, así que
   es por donde se navega a una categoría con teclado o en un test. */

import { ArrowDownRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { IconFor } from '../../../../shared/design/icons';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { CategoryTotal } from '../../domain/totals';

export type ExpenseDonutProps = {
  data: CategoryTotal[];
  total: number;
  onSliceClick: (categoryId: string) => void;
};

type DonutTooltipProps = {
  active?: boolean;
  payload?: { payload: CategoryTotal }[];
  total: number;
};

function DonutTooltip({ active, payload, total }: DonutTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]!.payload;
  const pct = total ? Math.round((d.total / total) * 100) : 0;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.text }}>
      <p className="font-semibold" style={{ color: d.color }}>{d.name}</p>
      <p className="font-mono-custom">{formatMoney(d.total)} · {pct}%</p>
    </div>
  );
}

export function ExpenseDonut({ data, total, onSliceClick }: ExpenseDonutProps) {
  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <ArrowDownRight size={20} style={{ color: COLORS.textFaint }} />
        </div>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Aún no hay gastos este mes.<br />Usa el botón + para registrar el primero.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="relative" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none">
              {data.map(d => (
                <Cell key={d.id} fill={d.color} style={{ cursor: 'pointer', outline: 'none' }} onClick={() => onSliceClick(d.id)} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>Gastos</span>
          <span className="font-mono-custom font-bold text-xl" style={{ color: COLORS.text }}>{formatMoney(total)}</span>
        </div>
      </div>
      <div className="mt-2">
        {data.map(d => {
          const Icon = IconFor(d.icon);
          const pct = total ? Math.round((d.total / total) * 100) : 0;
          return (
            <button key={d.id} onClick={() => onSliceClick(d.id)} className="w-full flex items-center gap-3 py-2 rounded-lg active:opacity-70 transition-opacity">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <Icon size={14} style={{ color: d.color }} />
              <span className="flex-1 text-left text-sm truncate" style={{ color: COLORS.text }}>{d.name}</span>
              <span className="text-xs" style={{ color: COLORS.textMuted }}>{pct}%</span>
              <span className="font-mono-custom text-sm font-medium" style={{ color: COLORS.text }}>{formatMoney(d.total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
