import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  /** Texto bajo el número central. */
  centerLabel: string;
  size?: number;
  /** Leyenda al lado (true) o debajo (false). */
  legendSide?: boolean;
  className?: string;
}

function pct(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
}

function makeTooltip(total: number) {
  return function DonutTooltip({ active, payload }: TooltipProps<number, string>) {
    const s = payload?.[0]?.payload as DonutSlice | undefined;
    if (!active || !s) return null;
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
        <p className="mb-0.5 flex items-center gap-1.5 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
          {s.label}
        </p>
        <p>
          <span className="font-semibold tabular-nums">{s.value}</span>{' '}
          <span className="text-muted-foreground">({pct(s.value, total)})</span>
        </p>
      </div>
    );
  };
}

/**
 * Torta tipo anillo con el total al centro y leyenda con valor y %.
 * Las porciones van separadas por un borde del color de la tarjeta.
 */
export function DonutChart({ data, centerLabel, size = 148, legendSide = true, className }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);

  return (
    <div
      className={cn(
        'flex gap-4',
        legendSide ? 'flex-col items-center sm:flex-row sm:items-center' : 'flex-col items-center',
        className,
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {total === 0 ? (
              <Pie
                data={[{ value: 1 }]}
                dataKey="value"
                innerRadius="68%"
                outerRadius="100%"
                fill="hsl(var(--muted))"
                stroke="none"
                isAnimationActive={false}
              />
            ) : (
              <Pie
                data={visible}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {visible.map((d) => (
                  <Cell key={d.key} fill={d.color} />
                ))}
              </Pie>
            )}
            {total > 0 && <Tooltip content={makeTooltip(total)} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{total}</span>
          <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.key} className={cn('flex items-center gap-2', d.value === 0 && 'opacity-50')}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">{pct(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
