import { useMemo } from 'react';
import { CalendarPlus, Clock, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { ReportBarChart, ReportDonutChart, ReportLineChart } from '@/components/reports/ReportCharts';
import type { DashboardStats, ReincidenceLevel } from '@/types';
import type {
  DailyIncidentPoint,
  ReportSectionActivityRow,
  ReportTopStudentRow,
} from '@/lib/services/dashboardService';

const STATUS_COLORS = {
  active: 'hsl(0, 62%, 52%)',
  justified: 'hsl(142, 45%, 42%)',
  annulled: 'hsl(215, 14%, 55%)',
  inReview: 'hsl(38, 92%, 50%)',
};

function shortLevel(level: string): string {
  return level === 'Primaria' ? 'Prim.' : 'Sec.';
}

function per100(incidents: number, enrolled: number): number {
  return enrolled > 0 ? Math.round((incidents * 1000) / enrolled) / 10 : 0;
}

function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '—';
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}

export function ReportInsights({
  stats,
  sectionActivity,
  topStudents,
  dailyTrend,
  available,
  onCite,
}: {
  stats: DashboardStats;
  sectionActivity: ReportSectionActivityRow[];
  topStudents: ReportTopStudentRow[];
  dailyTrend: DailyIncidentPoint[];
  /** false cuando los datos vienen del cálculo en navegador (sin RPC v2). */
  available: boolean;
  onCite: (student: ReportTopStudentRow) => void;
}) {
  const status = stats.statusCounts;

  const sectionRates = useMemo(
    () =>
      sectionActivity
        .filter((row) => row.enrolled > 0)
        .map((row) => ({
          label: `${shortLevel(row.level)} ${row.grade} ${row.section}`,
          rate: per100(row.incidents, row.enrolled),
          incidents: row.incidents,
          tardies: row.tardies,
          enrolled: row.enrolled,
        })),
    [sectionActivity],
  );

  const gradeRates = useMemo(() => {
    const groups = new Map<string, { label: string; incidents: number; enrolled: number }>();
    for (const row of sectionActivity) {
      const key = `${row.level}|${row.grade}`;
      const group = groups.get(key) ?? { label: `${shortLevel(row.level)} ${row.grade}`, incidents: 0, enrolled: 0 };
      group.incidents += row.incidents;
      group.enrolled += row.enrolled;
      groups.set(key, group);
    }
    return [...groups.values()]
      .filter((g) => g.enrolled > 0)
      .map((g) => ({ label: g.label, rate: per100(g.incidents, g.enrolled) }));
  }, [sectionActivity]);

  if (!available || !status) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Los indicadores de estado, tasa por alumno, reincidentes y tardanzas se calculan para todo el
          colegio, nivel o grado. Quite el filtro de sección para verlos.
        </span>
      </div>
    );
  }

  const resolved = status.justified + status.annulled;
  const resolutionRate = status.registered > 0 ? Math.round((resolved / status.registered) * 100) : 0;
  const statusItems = [
    { key: 'active', label: 'Activas', value: status.active, color: STATUS_COLORS.active },
    { key: 'justified', label: 'Justificadas', value: status.justified, color: STATUS_COLORS.justified },
    { key: 'annulled', label: 'Anuladas', value: status.annulled, color: STATUS_COLORS.annulled },
    { key: 'inReview', label: 'En revisión', value: status.inReview, color: STATUS_COLORS.inReview },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Estado de las incidencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <ReportDonutChart
              items={statusItems}
              centerValue={`${resolutionRate}%`}
              centerLabel="resueltas"
              height={180}
            />
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {statusItems.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
                    {item.label}
                  </span>
                  <span className="font-semibold tabular-nums">{item.value}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden />
                Tiempo medio hasta justificar
              </span>
              <span className="font-semibold tabular-nums">{formatHours(stats.avgHoursToJustify)}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Resueltas = justificadas + anuladas sobre {status.registered} registradas en el periodo.
            </p>
          </CardContent>
        </Card>

        <Card className="app-card lg:col-span-2">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Tendencia diaria (días hábiles)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {dailyTrend.length > 0 ? (
              <ReportLineChart
                data={dailyTrend}
                categoryKey="day"
                series={[{ key: 'incidents', label: 'Incidencias', color: 'hsl(217, 48%, 42%)' }]}
                height={300}
              />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Sin días hábiles en el periodo
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Incidencias por cada 100 alumnos · grado</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {gradeRates.length > 0 ? (
              <ReportBarChart
                data={gradeRates}
                categoryKey="label"
                series={[{ key: 'rate', label: 'Por cada 100 alumnos', color: 'hsl(262, 45%, 52%)' }]}
                orientation="rows"
                categoryWidth={90}
                height={Math.max(220, gradeRates.length * 30)}
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground">Sin alumnos en el alcance</div>
            )}
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-section-title">Incidencias por cada 100 alumnos · sección</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {sectionRates.length > 0 ? (
              <ReportBarChart
                data={sectionRates}
                categoryKey="label"
                series={[{ key: 'rate', label: 'Por cada 100 alumnos', color: 'hsl(217, 48%, 42%)' }]}
                orientation="rows"
                categoryWidth={100}
                height={Math.max(220, sectionRates.length * 26)}
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground">Sin alumnos en el alcance</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-section-title">Tardanzas frente a incidencias por sección</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {sectionRates.length > 0 ? (
            <ReportBarChart
              data={sectionRates}
              categoryKey="label"
              series={[
                { key: 'incidents', label: 'Incidencias', color: 'hsl(0, 62%, 52%)' },
                { key: 'tardies', label: 'Tardanzas', color: 'hsl(38, 92%, 50%)' },
              ]}
              height={340}
            />
          ) : (
            <div className="flex h-[240px] items-center justify-center text-muted-foreground">Sin datos para comparar</div>
          )}
        </CardContent>
      </Card>

      <Card className="app-card">
        <CardHeader className="app-card-header">
          <CardTitle className="app-section-title">Top 10 alumnos reincidentes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {topStudents.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Sin incidencias activas en el periodo</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Alumno</th>
                    <th className="px-3 py-2">Aula</th>
                    <th className="px-3 py-2 text-center">Incidencias</th>
                    <th className="px-3 py-2 text-center">Nivel máx.</th>
                    <th className="px-3 py-2">Última</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {topStudents.map((student, index) => (
                    <tr key={student.studentId} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 font-medium">{student.fullName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {shortLevel(student.level)} {student.grade} {student.section}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{student.incidents}</td>
                      <td className="px-3 py-2 text-center">
                        <ReincidenceBadge
                          level={Math.min(5, Math.max(0, student.maxReincidence)) as ReincidenceLevel}
                          short
                        />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {student.lastIncidentAt
                          ? format(new Date(student.lastIncidentAt), 'dd/MM/yyyy', { locale: es })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onCite(student)}>
                          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                          Citar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
