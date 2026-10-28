import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlarmClock } from 'lucide-react';
import type { IntegralStudentBlock } from '@/lib/services/integralReportService';
import { DonutChart } from './DonutChart';
import { ARRIVAL_STATUS_COLORS } from './latenessColors';
import { niceAxisScale } from '@/lib/utils/chartAxis';

function isLate(status: string): boolean {
  return status === 'Tarde';
}

function isLateJustified(status: string): boolean {
  return status === 'Tarde justificada' || status === 'Tarde_justificada' || status === 'Justificada';
}

type MonthRow = { month: string; label: string; late: number; justified: number };

function MonthTooltip({ active, payload }: TooltipProps<number, string>) {
  const m = payload?.[0]?.payload as MonthRow | undefined;
  if (!active || !m) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-0.5 font-semibold capitalize">{format(parseISO(`${m.month}-01`), 'MMMM yyyy', { locale: es })}</p>
      <p>
        <span className="font-semibold tabular-nums">{m.late}</span>{' '}
        <span className="text-muted-foreground">sin justificar</span>
      </p>
      <p>
        <span className="font-semibold tabular-nums">{m.justified}</span>{' '}
        <span className="text-muted-foreground">justificadas</span>
      </p>
    </div>
  );
}

/** Resumen compacto de tardanzas de un alumno: total, llegadas y tardanzas por mes. */
export function StudentLatenessCard({ manana }: { manana: IntegralStudentBlock['manana'] }) {
  const months = useMemo(() => {
    const map = new Map<string, MonthRow>();
    for (const r of manana.records) {
      const late = isLate(r.status);
      const justified = isLateJustified(r.status);
      if (!late && !justified) continue;
      const month = r.date.slice(0, 7);
      const row = map.get(month) ?? {
        month,
        label: format(parseISO(`${month}-01`), 'MMM', { locale: es }),
        late: 0,
        justified: 0,
      };
      if (late) row.late += 1;
      else row.justified += 1;
      map.set(month, row);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [manana.records]);

  const axis = niceAxisScale(Math.max(0, ...months.map((m) => m.late + m.justified)), 2);
  const total = manana.late + manana.lateJustified;
  const arrivals = manana.onTime + total;
  const absences = manana.absentJustified + manana.unjustified;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'hsl(var(--late-1))', color: 'hsl(var(--late-5))' }}
          >
            <AlarmClock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Tardanzas del período</h4>
            <p className="text-xs text-muted-foreground">
              {total === 0
                ? 'Sin tardanzas'
                : `${manana.lateJustified} justificada${manana.lateJustified === 1 ? '' : 's'}` +
                  (arrivals > 0 ? ` · ${Math.round((total / arrivals) * 100)}% de sus llegadas` : '')}
            </p>
          </div>
        </div>
        <span className="text-3xl font-bold leading-none tabular-nums text-foreground">{total}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DonutChart
          centerLabel="días"
          size={112}
          data={[
            { key: 'onTime', label: 'A tiempo', value: manana.onTime, color: ARRIVAL_STATUS_COLORS.onTime },
            { key: 'late', label: 'Tarde', value: manana.late, color: ARRIVAL_STATUS_COLORS.late },
            {
              key: 'lateJustified',
              label: 'Tarde justificada',
              value: manana.lateJustified,
              color: ARRIVAL_STATUS_COLORS.lateJustified,
            },
            { key: 'absent', label: 'Faltas', value: absences, color: ARRIVAL_STATUS_COLORS.absent },
          ]}
        />

        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tardanzas por mes</p>
          {months.length === 0 ? (
            <p className="flex h-[120px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Sin tardanzas en el período
            </p>
          ) : (
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="24%">
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis width={24} allowDecimals={false} domain={[0, axis.max]} ticks={axis.ticks} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Tooltip content={<MonthTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
                  <Bar dataKey="late" stackId="t" fill={ARRIVAL_STATUS_COLORS.late} maxBarSize={26} isAnimationActive={false} />
                  <Bar
                    dataKey="justified"
                    stackId="t"
                    fill={ARRIVAL_STATUS_COLORS.lateJustified}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
