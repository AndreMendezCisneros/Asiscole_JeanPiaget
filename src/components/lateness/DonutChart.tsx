import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
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

/**
 * Torta tipo anillo con el total al centro y leyenda con valor y %.
 * Al pasar el cursor por una porción (o por su fila de la leyenda) el centro muestra
 * esa porción y el resto se atenúa; no hay recuadro flotante que tape el gráfico.
 */
export function DonutChart({ data, centerLabel, size = 148, legendSide = true, className }: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const visible = data.filter((d) => d.value > 0);
  const active = data.find((d) => d.key === activeKey && d.value > 0) ?? null;

  return (
    <div
      className={cn(
        'flex gap-4',
        legendSide ? 'flex-col items-center sm:flex-row sm:items-center' : 'flex-col items-center',
        className,
      )}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }} onMouseLeave={() => setActiveKey(null)}>
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
                onMouseEnter={(_, index) => setActiveKey(visible[index]?.key ?? null)}
              >
                {visible.map((d) => (
                  <Cell
                    key={d.key}
                    fill={d.color}
                    fillOpacity={active && active.key !== d.key ? 0.3 : 1}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[18%] text-center">
          {active ? (
            <>
              <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{active.value}</span>
              <span className="mt-1 text-[11px] font-semibold tabular-nums" style={{ color: active.color }}>
                {pct(active.value, total)}
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold leading-none tabular-nums text-foreground">{total}</span>
              <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-0.5 text-xs" onMouseLeave={() => setActiveKey(null)}>
        {data.map((d) => (
          <li
            key={d.key}
            onMouseEnter={() => d.value > 0 && setActiveKey(d.key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors',
              d.value === 0 && 'opacity-50',
              active?.key === d.key && 'bg-muted',
              active && active.key !== d.key && d.value > 0 && 'opacity-60',
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden />
            <span className={cn('min-w-0 flex-1 truncate', active?.key === d.key ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {d.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{d.value}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">{pct(d.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
