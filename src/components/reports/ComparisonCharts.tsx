import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import { StaffSegmentedControl } from '@/components/staff';
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getReincidenceLevelBarColor } from '@/lib/utils/reincidenceUtils';
import { heatStep } from '@/lib/utils/latenessStats';
import { cn } from '@/lib/utils';
import { ChartInsight, ChartTooltipBox, TooltipRow } from './ChartTooltipBox';

export type GradeComparison = {
  grade: string;
  level: string;
  label: string;
  totalIncidents: number;
  studentsWithIncidents: number;
  averageReincidence: number;
  levelDistribution: { level0: number; level1: number; level2: number; level3: number; level4: number };
};

export type SectionComparison = {
  section: string;
  grade: string;
  level: string;
  label: string;
  totalIncidents: number;
  studentsWithIncidents: number;
  averageReincidence: number;
};

const LEVEL_KEYS = ['level0', 'level1', 'level2', 'level3', 'level4'] as const;
const LEVEL_NAMES = ['Nivel 0', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4'];
const RATIO_BAR = 'hsl(217 62% 46%)';

const LEVEL_SHORT: Record<string, string> = { Primaria: 'Prim.', Secundaria: 'Sec.', Inicial: 'Inic.' };

function shortLabel(level: string, grade: string, multiLevel: boolean): string {
  return multiLevel ? `${LEVEL_SHORT[level] ?? level} ${grade}` : grade;
}

/* ───────────── Comparativa por grados ───────────── */

type GradePoint = GradeComparison & { short: string; ratio: number };

function CompositionTooltip({ active, payload }: TooltipProps<number, string>) {
  const g = payload?.[0]?.payload as GradePoint | undefined;
  if (!active || !g) return null;
  return (
    <ChartTooltipBox title={g.label}>
      {LEVEL_KEYS.map((k, i) => (
        <TooltipRow key={k} label={LEVEL_NAMES[i]} value={g.levelDistribution[k]} color={getReincidenceLevelBarColor(i)} />
      ))}
      <div className="mt-1 border-t pt-1">
        <TooltipRow label="Total" value={g.totalIncidents} />
      </div>
    </ChartTooltipBox>
  );
}

function RatioTooltip({ active, payload }: TooltipProps<number, string>) {
  const g = payload?.[0]?.payload as GradePoint | undefined;
  if (!active || !g) return null;
  return (
    <ChartTooltipBox title={g.label}>
      <TooltipRow label="Incidencias por alumno" value={g.ratio.toFixed(1)} color={RATIO_BAR} />
      <TooltipRow label="Incidencias" value={g.totalIncidents} />
      <TooltipRow label="Alumnos involucrados" value={g.studentsWithIncidents} />
      <TooltipRow label="Nivel promedio" value={g.averageReincidence.toFixed(2)} />
    </ChartTooltipBox>
  );
}

/**
 * Comparativa por grados en dos lecturas:
 * composición por nivel de reincidencia, o cuántas incidencias acumula cada alumno involucrado.
 */
export function GradeComparisonChart({ rows }: { rows: GradeComparison[] }) {
  const [view, setView] = useState<'composition' | 'ratio'>('composition');
  if (rows.length === 0) {
    return <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No hay datos para comparar</p>;
  }

  const multiLevel = new Set(rows.map((r) => r.level)).size > 1;
  const data: GradePoint[] = rows.map((r) => ({
    ...r,
    short: shortLabel(r.level, r.grade, multiLevel),
    ratio: r.studentsWithIncidents > 0 ? r.totalIncidents / r.studentsWithIncidents : 0,
  }));
  const ratioSorted = [...data].sort((a, b) => b.ratio - a.ratio);
  const worstRatio = ratioSorted[0];
  const mostCritical = [...data].sort(
    (a, b) => b.levelDistribution.level3 + b.levelDistribution.level4 - (a.levelDistribution.level3 + a.levelDistribution.level4),
  )[0];
  const criticalCount = mostCritical.levelDistribution.level3 + mostCritical.levelDistribution.level4;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <StaffSegmentedControl
          aria-label="Vista de la comparativa por grados"
          value={view}
          onValueChange={(v) => setView(v as 'composition' | 'ratio')}
          options={[
            { value: 'composition', label: 'Por gravedad' },
            { value: 'ratio', label: 'Por alumno' },
          ]}
          className="w-full sm:w-[260px]"
          listClassName="grid-cols-2 sm:grid-cols-2"
        />
      </div>

      <div className="h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'composition' ? (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="short"
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                interval={0}
              />
              <YAxis
                width={36}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip content={<CompositionTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
              />
              {LEVEL_KEYS.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={`levelDistribution.${k}`}
                  name={LEVEL_NAMES[i]}
                  stackId="lvl"
                  fill={getReincidenceLevelBarColor(i)}
                  stroke="hsl(var(--card))"
                  strokeWidth={1}
                  radius={i === LEVEL_KEYS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={44}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : (
            <BarChart data={ratioSorted} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="short"
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                interval={0}
              />
              <YAxis width={36} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip content={<RatioTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
              <Bar dataKey="ratio" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                {ratioSorted.map((g, i) => (
                  <Cell key={g.label} fill={RATIO_BAR} fillOpacity={i < 3 ? 1 : 0.45} />
                ))}
                <LabelList
                  dataKey="ratio"
                  position="top"
                  formatter={(v: number) => v.toFixed(1)}
                  style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <ChartInsight>
        {view === 'composition' ? (
          criticalCount > 0 ? (
            <>
              {mostCritical.label} tiene más casos de nivel 3 o 4 ({criticalCount}). Cada barra muestra cómo se reparten sus
              incidencias por gravedad.
            </>
          ) : (
            <>Ningún grado tiene casos de nivel 3 o 4 en el período.</>
          )
        ) : (
          <>
            En {worstRatio.label} cada alumno involucrado acumula {worstRatio.ratio.toFixed(1)} incidencias en promedio: las
            faltas se concentran en pocos alumnos.
          </>
        )}
      </ChartInsight>

      <details className="group mt-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-primary hover:underline">
          Ver tabla detallada
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Grado</th>
                <th className="px-3 py-2 text-right font-medium">Incidencias</th>
                <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                <th className="px-3 py-2 text-right font-medium">Por alumno</th>
                <th className="px-3 py-2 text-right font-medium">Nivel prom.</th>
                {LEVEL_NAMES.map((n, i) => (
                  <th key={n} className="px-2 py-2 text-center font-medium">
                    <span className={cn('app-level-pill', `app-level-pill--${i}`)}>{i}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((g) => (
                <tr key={g.label} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-foreground">{g.label}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{g.totalIncidents}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.studentsWithIncidents}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.ratio.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.averageReincidence.toFixed(2)}</td>
                  {LEVEL_KEYS.map((k) => (
                    <td
                      key={k}
                      className={cn(
                        'px-2 py-2 text-center tabular-nums',
                        g.levelDistribution[k] === 0 ? 'text-muted-foreground/50' : 'text-foreground',
                      )}
                    >
                      {g.levelDistribution[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ───────────── Comparativa por secciones (mapa) ───────────── */

/** Mapa grado × sección en azul: dónde se concentran las incidencias. */
export function SectionHeatmap({ rows }: { rows: SectionComparison[] }) {
  if (rows.length === 0) {
    return <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No hay datos para comparar</p>;
  }

  const multiLevel = new Set(rows.map((r) => r.level)).size > 1;
  const sections = [...new Set(rows.map((r) => r.section))].sort((a, b) => a.localeCompare(b));
  const gradeKeys: { key: string; label: string; cells: Record<string, SectionComparison> }[] = [];
  for (const r of rows) {
    const key = `${r.level}|${r.grade}`;
    let g = gradeKeys.find((x) => x.key === key);
    if (!g) {
      g = { key, label: shortLabel(r.level, r.grade, multiLevel), cells: {} };
      gradeKeys.push(g);
    }
    g.cells[r.section] = r;
  }
  const max = Math.max(0, ...rows.map((r) => r.totalIncidents));
  const total = rows.reduce((s, r) => s + r.totalIncidents, 0);
  const ranked = [...rows].sort((a, b) => b.totalIncidents - a.totalIncidents);
  const top3 = ranked.slice(0, 3).filter((r) => r.totalIncidents > 0);
  const top3Sum = top3.reduce((s, r) => s + r.totalIncidents, 0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <div className="min-w-0 xl:col-span-3">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-separate" style={{ borderSpacing: '5px' }}>
            <caption className="sr-only">Incidencias por grado y sección</caption>
            <thead>
              <tr>
                <th className="w-20 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Grado</th>
                {sections.map((s) => (
                  <th key={s} className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradeKeys.map((g) => (
                <tr key={g.key}>
                  <th scope="row" className="whitespace-nowrap pr-1 text-left text-sm font-semibold text-foreground">
                    {g.label}
                  </th>
                  {sections.map((s) => {
                    const c = g.cells[s];
                    if (!c) {
                      return (
                        <td key={s} className="p-0">
                          <div className="h-12 w-full min-w-[3rem] rounded-lg border border-dashed border-border/70" />
                        </td>
                      );
                    }
                    const step = heatStep(c.totalIncidents, max);
                    return (
                      <td key={s} className="p-0">
                        <UiTooltip delayDuration={80}>
                          <TooltipTrigger asChild>
                            <div
                              tabIndex={0}
                              className="flex h-12 w-full min-w-[3rem] cursor-default flex-col items-center justify-center rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring"
                              style={{
                                backgroundColor: `hsl(var(--inc-${step}))`,
                                color: `hsl(var(--inc-text-${step}))`,
                              }}
                              aria-label={`${c.label}: ${c.totalIncidents} incidencias`}
                            >
                              <span className="text-base font-bold leading-none tabular-nums">{c.totalIncidents}</span>
                              {c.totalIncidents > 0 && (
                                <span className="mt-0.5 text-[10px] leading-none opacity-80">{c.studentsWithIncidents} al.</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="w-52">
                            <p className="mb-1 text-sm font-semibold">{c.label}</p>
                            <div className="space-y-0.5 text-xs">
                              <TooltipRow label="Incidencias" value={c.totalIncidents} />
                              <TooltipRow label="Alumnos involucrados" value={c.studentsWithIncidents} />
                              <TooltipRow label="Nivel promedio" value={c.averageReincidence.toFixed(2)} />
                              <TooltipRow
                                label="Del total"
                                value={total > 0 ? `${((c.totalIncidents / total) * 100).toFixed(0)}%` : '0%'}
                              />
                            </div>
                          </TooltipContent>
                        </UiTooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Menos</span>
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <span
              key={step}
              className={cn('h-3 w-5 rounded-[3px]', step === 0 && 'ring-1 ring-inset ring-border')}
              style={{ backgroundColor: `hsl(var(--inc-${step}))` }}
              aria-hidden
            />
          ))}
          <span>Más incidencias</span>
          <span className="ml-2">· «al.» = alumnos involucrados</span>
        </div>
      </div>

      <div className="min-w-0 xl:col-span-2">
        <p className="mb-3 text-sm font-semibold text-foreground">Secciones con más incidencias</p>
        <ol className="space-y-2">
          {ranked.slice(0, 6).map((r, i) => (
            <li key={r.label} className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                style={{
                  backgroundColor: `hsl(var(--inc-${heatStep(r.totalIncidents, max)}))`,
                  color: `hsl(var(--inc-text-${heatStep(r.totalIncidents, max)}))`,
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {shortLabel(r.level, r.grade, multiLevel)} {r.section}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{r.totalIncidents}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${max > 0 ? (r.totalIncidents / max) * 100 : 0}%`, backgroundColor: 'hsl(var(--inc-4))' }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
        {top3.length >= 2 && total > 0 && (
          <ChartInsight>
            {top3.length} secciones reúnen el{' '}
            <span className="font-semibold text-foreground">{((top3Sum / total) * 100).toFixed(0)}%</span> de las incidencias.
          </ChartInsight>
        )}
      </div>
    </div>
  );
}
