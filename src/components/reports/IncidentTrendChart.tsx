import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { niceAxisScale } from '@/lib/utils/chartAxis';
import { ChartInsight, ChartStat, ChartTooltipBox, TooltipRow } from './ChartTooltipBox';

const LINE = 'hsl(217 62% 46%)';

type Point = { month: string; incidents: number };

function TrendTooltip({ active, payload, average }: TooltipProps<number, string> & { average: number }) {
  const p = payload?.[0]?.payload as Point | undefined;
  if (!active || !p) return null;
  const diff = p.incidents - average;
  return (
    <ChartTooltipBox title={<span className="capitalize">{p.month}</span>}>
      <TooltipRow label="Incidencias" value={p.incidents} color={LINE} />
      <TooltipRow
        label="Frente al promedio"
        value={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`}
      />
    </ChartTooltipBox>
  );
}

function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'Nuevo' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

/** Tendencia mensual: área con línea de promedio y mes pico marcado. */
export function IncidentTrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">Sin datos en el período</p>;
  }

  const total = data.reduce((s, d) => s + d.incidents, 0);
  const average = total / data.length;
  const peak = data.reduce((best, d) => (d.incidents > best.incidents ? d : best), data[0]);
  const last = data[data.length - 1];
  const prev = data.length >= 2 ? data[data.length - 2] : null;
  const axis = niceAxisScale(Math.max(0, ...data.map((d) => d.incidents)));
  const rising = prev ? last.incidents > prev.incidents : false;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ChartStat label="Total" value={total} hint={`${data.length} meses`} />
        <ChartStat label="Promedio" value={average.toFixed(1)} hint="por mes" />
        <ChartStat label="Mes pico" value={<span className="capitalize">{peak.month}</span>} hint={`${peak.incidents} incidencias`} />
        <ChartStat
          label={`${last.month} vs anterior`}
          value={
            prev ? (
              <span className={rising ? 'text-destructive' : 'text-success'}>{formatDelta(last.incidents, prev.incidents)}</span>
            ) : (
              '—'
            )
          }
          hint={prev ? `${prev.incidents} → ${last.incidents}` : undefined}
        />
      </div>

      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 28, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="incTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              width={36}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              domain={[0, axis.max]}
              ticks={axis.ticks}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip
              content={<TrendTooltip average={average} />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
            />
            <ReferenceLine
              y={average}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 4"
              label={{
                value: `Promedio ${average.toFixed(1)}`,
                position: 'insideTopRight',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 11,
              }}
            />
            <Area
              type="monotone"
              dataKey="incidents"
              stroke={LINE}
              strokeWidth={2}
              fill="url(#incTrendFill)"
              dot={{ r: 3.5, fill: 'hsl(var(--card))', stroke: LINE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: LINE, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            {peak.incidents > 0 && (
              <ReferenceDot
                x={peak.month}
                y={peak.incidents}
                r={7}
                fill={LINE}
                stroke="hsl(var(--card))"
                strokeWidth={3}
                label={{ value: 'Pico', position: 'top', fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 600 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {peak.incidents > 0 && (
        <ChartInsight>
          <span className="capitalize">{peak.month}</span> fue el mes con más incidencias ({peak.incidents},{' '}
          {average > 0 ? `${(peak.incidents / average).toFixed(1)} veces el promedio` : 'sin promedio'}).
          {prev && (
            <>
              {' '}
              En <span className="capitalize">{last.month}</span> {rising ? 'subieron' : last.incidents < prev.incidents ? 'bajaron' : 'se mantuvieron'} respecto al mes anterior.
            </>
          )}
        </ChartInsight>
      )}
    </div>
  );
}
