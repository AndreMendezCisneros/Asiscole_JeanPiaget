import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { DonutChart } from '@/components/lateness/DonutChart';
import { LEVEL_COLORS, LEVEL_FALLBACK_COLOR } from '@/components/lateness/latenessColors';
import {
  getReincidenceLevelBarColor,
  getReincidenceLevelSummaryLabel,
  REINCIDENCE_LEVELS,
} from '@/lib/utils/reincidenceUtils';
import type { DashboardStats, ReincidenceLevel } from '@/types';
import { niceAxisScale } from '@/lib/utils/chartAxis';
import { ChartInsight, ChartTooltipBox, TooltipRow } from './ChartTooltipBox';

const BAR = 'hsl(217 62% 46%)';
const BAR_SOFT = 'hsl(214 75% 84%)';

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '0%';
}

/* ───────────── Día de la semana ───────────── */

type DayPoint = { day: string; count: number };

function DayTooltip({ active, payload, total }: TooltipProps<number, string> & { total: number }) {
  const d = payload?.[0]?.payload as DayPoint | undefined;
  if (!active || !d) return null;
  return (
    <ChartTooltipBox title={d.day}>
      <TooltipRow label="Incidencias" value={d.count} color={BAR} />
      <TooltipRow label="De la semana" value={pct(d.count, total)} />
    </ChartTooltipBox>
  );
}

/** Incidencias por día: el día con más se resalta, el resto en tono suave. */
export function WeekdayChart({ data }: { data: DayPoint[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(0, ...data.map((d) => d.count));
  const peak = data.find((d) => d.count === max && max > 0);
  const axis = niceAxisScale(max);

  return (
    <div>
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis hide domain={[0, axis.max]} />
            <Tooltip content={<DayTooltip total={total} />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.day} fill={d.count === max && max > 0 ? BAR : BAR_SOFT} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {peak && (
        <ChartInsight>
          {peak.day} concentra {pct(peak.count, total)} de las incidencias de la semana ({peak.count} de {total}).
        </ChartInsight>
      )}
    </div>
  );
}

/* ───────────── Nivel de reincidencia ───────────── */

type LevelKey = 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

/** Torta por nivel de reincidencia con aviso de casos críticos (niveles 3 o más). */
export function ReincidenceDonut({
  distribution,
  visibleLevels,
}: {
  distribution: DashboardStats['levelDistribution'];
  /** Niveles que deja ver el filtro «Enfoque». */
  visibleLevels: number[];
}) {
  const levels = REINCIDENCE_LEVELS.filter(
    (l) => visibleLevels.includes(l) && (l < 5 || (distribution.level5 ?? 0) > 0),
  );
  const slices = levels.map((l) => ({
    key: `level${l}`,
    label: `Nv. ${l} · ${getReincidenceLevelSummaryLabel(l as ReincidenceLevel)}`,
    value: distribution[`level${l}` as LevelKey] ?? 0,
    color: getReincidenceLevelBarColor(l),
  }));
  const total = REINCIDENCE_LEVELS.reduce((s, l) => s + (distribution[`level${l}` as LevelKey] ?? 0), 0);
  const critical = (distribution.level3 ?? 0) + (distribution.level4 ?? 0) + (distribution.level5 ?? 0);

  return (
    <div className="space-y-4">
      <DonutChart data={slices} centerLabel="incidencias" size={160} />
      <div
        className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
        style={{
          borderColor: critical > 0 ? 'hsl(var(--destructive) / 0.3)' : 'hsl(var(--border))',
          backgroundColor: critical > 0 ? 'hsl(var(--destructive) / 0.06)' : undefined,
        }}
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: critical > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            {critical} caso{critical === 1 ? '' : 's'} crítico{critical === 1 ? '' : 's'}
          </span>{' '}
          (nivel 3 o más) · {pct(critical, total)} del total. Requieren seguimiento de tutoría y coordinación.
        </p>
      </div>
    </div>
  );
}

/* ───────────── Faltas más frecuentes (Pareto) ───────────── */

type FaultPoint = { faultType: string; count: number; share: number; cumulative: number };

function FaultTooltip({ active, payload }: TooltipProps<number, string>) {
  const f = payload?.[0]?.payload as FaultPoint | undefined;
  if (!active || !f) return null;
  return (
    <ChartTooltipBox title={f.faultType}>
      <TooltipRow label="Incidencias" value={f.count} color={BAR} />
      <TooltipRow label="Del total" value={`${(f.share * 100).toFixed(1)}%`} />
      <TooltipRow label="Acumulado" value={`${(f.cumulative * 100).toFixed(0)}%`} />
    </ChartTooltipBox>
  );
}

/** Faltas más frecuentes: barras con % del total y cuánto concentran las primeras. */
export function TopFaultsChart({ faults, total }: { faults: DashboardStats['topFaults']; total: number }) {
  if (faults.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No hay datos disponibles</p>;
  }
  let acc = 0;
  const data: FaultPoint[] = faults.slice(0, 8).map((f) => {
    acc += f.count;
    return {
      ...f,
      share: total > 0 ? f.count / total : 0,
      cumulative: total > 0 ? acc / total : 0,
    };
  });
  const top3 = data.slice(0, 3);
  const top3Share = top3.length > 0 ? top3[top3.length - 1].cumulative : 0;

  return (
    <div>
      <div className="w-full min-w-0" style={{ height: Math.max(200, data.length * 40 + 8) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 4 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="faultType"
              width={150}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <Tooltip content={<FaultTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((f, i) => (
                <Cell key={f.faultType} fill={i < 3 ? BAR : BAR_SOFT} />
              ))}
              <LabelList
                dataKey="share"
                position="right"
                formatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {top3.length >= 2 && (
        <ChartInsight>
          Las {top3.length} faltas más comunes suman el{' '}
          <span className="font-semibold text-foreground">{(top3Share * 100).toFixed(0)}%</span> de las incidencias. Atenderlas
          primero tiene el mayor efecto.
        </ChartInsight>
      )}
    </div>
  );
}

/* ───────────── Por nivel / grado ───────────── */

type GradePoint = DashboardStats['incidentsByGrade'][number];

function GradeTooltip({ active, payload, total }: TooltipProps<number, string> & { total: number }) {
  const g = payload?.[0]?.payload as GradePoint | undefined;
  if (!active || !g) return null;
  return (
    <ChartTooltipBox title={g.label}>
      <TooltipRow label="Incidencias" value={g.count} color={LEVEL_COLORS[g.level] ?? LEVEL_FALLBACK_COLOR} />
      <TooltipRow label="Del total" value={pct(g.count, total)} />
    </ChartTooltipBox>
  );
}

/** Incidencias por grado, coloreadas por nivel educativo. */
export function GradeLevelChart({ data }: { data: GradePoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No hay datos para el filtro seleccionado
      </p>
    );
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  const levels = [...new Set(data.map((d) => d.level))];
  const top = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {levels.map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[l] ?? LEVEL_FALLBACK_COLOR }} />
            {l}
          </span>
        ))}
      </div>
      <div className="w-full min-w-0" style={{ height: Math.max(220, data.length * 32 + 8) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={6}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              width={130}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip content={<GradeTooltip total={total} />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.label} fill={LEVEL_COLORS[d.level] ?? LEVEL_FALLBACK_COLOR} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {top.count > 0 && (
        <ChartInsight>
          {top.label} es el grado con más incidencias ({top.count}, {pct(top.count, total)} del total).
        </ChartInsight>
      )}
    </div>
  );
}
