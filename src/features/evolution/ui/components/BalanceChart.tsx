/* La gráfica de área del saldo total. Componente de RENDERIZADO: la serie entra
   ya calculada.

   Es SVG de recharts, que necesita medir su contenedor; el resumen de al lado
   (`EvolutionSummary`) es el texto accesible con las mismas cifras. */

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLORS } from '../../../../shared/design/tokens';
import { formatMoney } from '../../../../shared/domain/money';
import type { BalancePoint, BalanceSeries } from '../../domain/series';

export type BalanceChartProps = {
  series: BalanceSeries;
  height?: number;
  /** Modo privado: la curva se conserva, los montos del tooltip no. */
  hideBalances?: boolean;
};

/** "3 jun" para plazos cortos, "jun 25" cuando la serie abarca más de un año. */
function formatTick(iso: string, long: boolean): string {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const label = long
    ? date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
    : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return label.replace('.', '');
}

function formatFullDate(iso: string): string {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: BalancePoint }[];
  hideBalances?: boolean;
};

function ChartTooltip({ active, payload, hideBalances }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.text }}>
      <p style={{ color: COLORS.textMuted }}>{formatFullDate(p.date)}</p>
      <p className="font-mono-custom font-semibold">{formatMoney(p.balance, hideBalances)}</p>
    </div>
  );
}

export function BalanceChart({ series, height = 220, hideBalances }: BalanceChartProps) {
  const { points, change } = series;
  const color = change > 0 ? COLORS.income : change < 0 ? COLORS.expense : COLORS.accent;
  const first = points[0]!.date;
  const last = points[points.length - 1]!.date;
  const long = (Date.parse(last) - Date.parse(first)) / 86_400_000 > 400;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="evolution-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => formatTick(v, long)}
            tick={{ fill: COLORS.textFaint, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          {/* Sin ticks: el eje solo fija la escala, para no mostrar montos
              sueltos (y para que el modo privado no tenga nada que ocultar). */}
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip content={<ChartTooltip hideBalances={hideBalances} />} cursor={{ stroke: COLORS.borderStrong }} />
          <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={2} fill="url(#evolution-fill)" dot={false} activeDot={{ r: 4, fill: color, stroke: COLORS.bg }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
