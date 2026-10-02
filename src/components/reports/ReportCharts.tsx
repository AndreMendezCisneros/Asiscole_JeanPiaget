import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export type ReportSeries = { key: string; label: string; color: string };

type Row = Record<string, string | number | null | undefined>;

function seriesConfig(series: ReportSeries[]): ChartConfig {
  return Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
}

const AXIS_TICK = { fontSize: 11 };

/** Barras verticales (categorías en X) u horizontales (categorías en Y, para etiquetas largas). */
export function ReportBarChart({
  data,
  categoryKey,
  series,
  orientation = 'columns',
  height = 300,
  categoryWidth = 150,
  stacked = false,
  showLegend = series.length > 1,
  className,
}: {
  data: Row[];
  categoryKey: string;
  series: ReportSeries[];
  orientation?: 'columns' | 'rows';
  height?: number;
  categoryWidth?: number;
  stacked?: boolean;
  showLegend?: boolean;
  className?: string;
}) {
  const rows = orientation === 'rows';
  return (
    <ChartContainer
      config={seriesConfig(series)}
      className={cn('aspect-auto w-full', className)}
      style={{ height }}
    >
      <BarChart data={data} layout={rows ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={rows} horizontal={!rows} strokeDasharray="3 3" />
        {rows ? (
          <>
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey={categoryKey}
              width={categoryWidth}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              interval={0}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={categoryKey}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} />
          </>
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.key}
            fill={`var(--color-${s.key})`}
            stackId={stacked ? 'stack' : undefined}
            radius={rows ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function ReportLineChart({
  data,
  categoryKey,
  series,
  height = 280,
  className,
}: {
  data: Row[];
  categoryKey: string;
  series: ReportSeries[];
  height?: number;
  className?: string;
}) {
  return (
    <ChartContainer
      config={seriesConfig(series)}
      className={cn('aspect-auto w-full', className)}
      style={{ height }}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey={categoryKey}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          interval="preserveStartEnd"
          minTickGap={10}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={AXIS_TICK} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={data.length <= 31}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}

export type ReportDonutItem = { key: string; label: string; value: number; color: string };

export function ReportDonutChart({
  items,
  centerValue,
  centerLabel,
  height = 200,
  className,
}: {
  items: ReportDonutItem[];
  centerValue?: string | number;
  centerLabel?: string;
  height?: number;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const data = total > 0 ? items.filter((item) => item.value > 0) : [{ key: 'empty', label: 'Sin datos', value: 1, color: 'hsl(var(--muted))' }];
  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <ChartContainer
        config={seriesConfig(items.map(({ key, label, color }) => ({ key, label, color })))}
        className="aspect-auto h-full w-full"
      >
        <PieChart>
          {total > 0 && <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />}
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="62%"
            outerRadius="88%"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      {(centerValue != null || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue != null && <span className="text-2xl font-bold tabular-nums leading-none">{centerValue}</span>}
          {centerLabel && <span className="mt-1 text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
