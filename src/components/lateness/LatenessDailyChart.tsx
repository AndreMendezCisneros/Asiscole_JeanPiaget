import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { niceAxisScale } from '@/lib/utils/chartAxis';
import type { LatenessDay } from '@/lib/utils/latenessStats';
import { LATE_TERMS, type CountTerms } from './LatenessHeatmap';

function DayTooltip({ active, payload, terms }: TooltipProps<number, string> & { terms: CountTerms }) {
  const d = payload?.[0]?.payload as LatenessDay | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-0.5 font-semibold capitalize">
        {format(parseISO(d.date), "EEEE d 'de' MMMM", { locale: es })}
      </p>
      <p>
        <span className="font-semibold tabular-nums">{d.lateCount}</span>{' '}
        <span className="text-muted-foreground">{d.lateCount === 1 ? terms.one : terms.many}</span>
      </p>
    </div>
  );
}

/** Tardanzas por día del período (solo días con registros). */
export function LatenessDailyChart({ days, terms = LATE_TERMS }: { days: LatenessDay[]; terms?: CountTerms }) {
  if (days.length === 0) return null;
  const axis = niceAxisScale(Math.max(0, ...days.map((d) => d.lateCount)));

  return (
    <div className="h-[220px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={(v: string) => format(parseISO(v), 'dd/MM')}
            minTickGap={16}
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            domain={[0, axis.max]}
            ticks={axis.ticks}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Tooltip content={<DayTooltip terms={terms} />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
          <Bar dataKey="lateCount" fill={`hsl(var(--${terms.ramp}-4))`} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
