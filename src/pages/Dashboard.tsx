import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Users,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Activity,
  Target,
  LayoutDashboard,
  BarChart3,
  List,
  UserPlus,
} from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
} from 'recharts';
import { useEffect } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardStats, Incident } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  StaffKpiStat,
  StaffQuickActions,
  StaffSection,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
  StaffActivityItem,
  StaffEmptyState,
} from '@/components/staff';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import {
  getReincidenceLevelBarColor,
  getReincidenceLevelSummaryLabel,
  REINCIDENCE_LEVELS,
} from '@/lib/utils/reincidenceUtils';
import { cn } from '@/lib/utils';
import type { ReincidenceLevel } from '@/types';
import {
  useDashboardStatsQuery,
  useDepartureAlertsQuery,
  useRecentIncidentsQuery,
  useMonthlyTrendQuery,
  useWeeklyAttendanceTrendQuery,
} from '@/hooks/queries/useDashboardQueries';

/** Paleta ejecutiva para gráficos (azul pizarra, sin acentos chillones) */
const CHART = {
  bar: 'hsl(217, 48%, 42%)',
  line: 'hsl(262, 45%, 52%)',
  grid: 'hsl(214, 16%, 90%)',
  axis: 'hsl(215, 14%, 48%)',
};

const ATTENDANCE_CHART = {
  onTime: 'hsl(142, 45%, 42%)',
  late: 'hsl(0, 62%, 52%)',
  total: 'hsl(217, 48%, 42%)',
};

export const Dashboard = () => {
  const statsQuery = useDashboardStatsQuery();
  const statsReady = statsQuery.isSuccess || Boolean(statsQuery.data);
  const alertsQuery = useDepartureAlertsQuery(statsReady);
  const recentIncidentsQuery = useRecentIncidentsQuery(statsReady);
  const monthlyTrendQuery = useMonthlyTrendQuery(statsReady);
  const weeklyAttendanceQuery = useWeeklyAttendanceTrendQuery(statsReady);
  const navigate = useNavigate();

  useEffect(() => {
    if (statsQuery.isError) {
      toast.error('Error al cargar estadísticas del dashboard');
    }
  }, [statsQuery.isError]);

  useEffect(() => {
    if (recentIncidentsQuery.isError) {
      toast.error('Error al cargar incidencias recientes');
    }
  }, [recentIncidentsQuery.isError]);

  useEffect(() => {
    if (weeklyAttendanceQuery.isError) {
      toast.error('Error al cargar datos de asistencia');
    }
  }, [weeklyAttendanceQuery.isError]);

  const stats: DashboardStats | null = statsQuery.data ?? null;
  const departureAlerts = alertsQuery.data ?? [];
  const recentIncidents: Incident[] = recentIncidentsQuery.data ?? [];
  const monthlyTrend = monthlyTrendQuery.data ?? [];
  const weeklyAttendance = weeklyAttendanceQuery.data ?? [];

  const initialLoading = statsQuery.isLoading && !stats;

  if (initialLoading) {
    return <PageLoader message="Cargando estadísticas del dashboard..." />;
  }

  if (!stats) {
    return (
      <div className="app-page">
        <div className="app-page-state border-l-4 border-l-destructive bg-destructive/5">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">
                No se pudieron cargar los datos del dashboard.
              </p>
              <p className="text-xs text-red-600/80">
                Puede ser un problema temporal de conexión. Intente de nuevo o recargue la página.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void statsQuery.refetch()}
                disabled={statsQuery.isFetching}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {statsQuery.isFetching ? 'Reintentando…' : 'Reintentar'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const levelDistributionRows = REINCIDENCE_LEVELS.map((level) => {
    const key = `level${level}` as keyof typeof stats.levelDistribution;
    return {
      level,
      value: stats.levelDistribution[key] ?? 0,
      label: getReincidenceLevelSummaryLabel(level),
      color: getReincidenceLevelBarColor(level),
    };
  });

  const levelTotal = levelDistributionRows.reduce((sum, item) => sum + item.value, 0);

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatGrowthBadge = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return null;
    const pct = calculatePercentageChange(current, previous);
    if (Math.abs(pct) > 999) {
      return `${pct > 0 ? '+' : ''}>999%`;
    }
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };

  const CHART_MARGIN = { top: 12, right: 12, left: 4, bottom: 4 };

  const maxTrend = Math.max(1, ...monthlyTrend.map((d) => d.incidents));
  const yAxisMax = Math.max(4, Math.ceil(maxTrend * 1.15));

  const maxAttendanceDay = Math.max(1, ...weeklyAttendance.map((d) => d.total));
  const attendanceYMax = Math.max(4, Math.ceil(maxAttendanceDay * 1.15));

  const todayAttendance =
    weeklyAttendance.length > 0 ? weeklyAttendance[weeklyAttendance.length - 1] : null;
  const attendanceGrowthBadge =
    weeklyAttendance.length >= 2
      ? formatGrowthBadge(
          weeklyAttendance[weeklyAttendance.length - 1].total,
          weeklyAttendance[weeklyAttendance.length - 2].total,
        )
      : null;

  // Calcular tasa de resolución
  const resolutionRate = stats.totalIncidents > 0 
    ? Math.min(100, Math.round(((stats.totalIncidents - stats.incidentsToday) / stats.totalIncidents) * 100))
    : 100;

  // Calcular porcentaje de crecimiento
  const growthPercentage = monthlyTrend.length >= 2
    ? calculatePercentageChange(
        monthlyTrend[monthlyTrend.length - 1].incidents,
        monthlyTrend[monthlyTrend.length - 2].incidents
      )
    : 0;

  const quickActions = [
    {
      label: 'Nueva incidencia',
      description: 'Registrar falta con escaneo',
      icon: UserPlus,
      to: '/register',
      tone: 'warning' as const,
    },
    {
      label: 'Lista de incidencias',
      description: 'Historial y detalle',
      icon: List,
      to: '/incidents',
      tone: 'primary' as const,
    },
    {
      label: 'Control de asistencia',
      description: 'Llegadas y salidas',
      icon: Clock,
      to: '/arrival-control',
      tone: 'success' as const,
    },
    {
      label: 'Reportes',
      description: 'Indicadores y exportación',
      icon: BarChart3,
      to: '/reports',
      tone: 'info' as const,
    },
  ];

  return (
    <div className="app-page app-page-shell w-full">
      <PageHeader icon={LayoutDashboard} title="Inicio" accent="primary" />

      <StaffQuickActions actions={quickActions} />

      <div className="app-kpi-grid">
        <StaffKpiStat
          label="Total incidencias"
          value={stats.totalIncidents}
          hint={`+${stats.incidentsThisMonth} este mes`}
          hintIcon={TrendingUp}
          icon={AlertCircle}
          tone="primary"
        />
        <StaffKpiStat
          label="Incidencias hoy"
          value={stats.incidentsToday}
          hint={
            stats.incidentsToday > 0
              ? `${stats.incidentsToday} registrada${stats.incidentsToday === 1 ? '' : 's'}`
              : 'Sin incidencias hoy'
          }
          hintIcon={stats.incidentsToday > 0 ? AlertCircle : CheckCircle2}
          icon={FileText}
          tone="warning"
        />
        <StaffKpiStat
          label="Estudiantes afectados"
          value={stats.studentsWithIncidents}
          hint={`${stats.incidentsThisWeek} esta semana`}
          hintIcon={Activity}
          icon={Users}
          tone="accent"
        />
        <StaffKpiStat
          label="Tasa de resolución"
          value={`${resolutionRate}%`}
          hint={resolutionRate > 80 ? 'Excelente' : 'Mejorable'}
          hintIcon={resolutionRate > 80 ? TrendingUp : TrendingDown}
          icon={Target}
          tone="success"
        />
      </div>

      <div className="app-dashboard-charts">
        <StaffDataPanel className="min-w-0 xl:col-span-2">
          <StaffDataPanelHeader
            compact
            accent="primary"
            title="Tendencia de incidencias"
            description="Últimos 5 meses"
            action={
              <span className="inline-flex shrink-0 items-center rounded-md border border-primary/25 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm">
                <ArrowUpRight className="mr-1 h-3 w-3" />
                {growthPercentage > 0 ? '+' : ''}
                {growthPercentage.toFixed(1)}%
              </span>
            }
          />
          <StaffDataPanelBody compact className="app-chart-surface !p-0">
            <div className="app-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrend} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="month"
                  stroke={CHART.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  stroke={CHART.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  allowDecimals={false}
                  domain={[0, yAxisMax]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="incidents"
                  fill={CHART.bar}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                  barSize={32}
                />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke={CHART.line}
                  strokeWidth={2}
                  dot={{
                    r: 5,
                    fill: 'hsl(var(--card))',
                    stroke: CHART.line,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 6, fill: CHART.line, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </StaffDataPanelBody>
        </StaffDataPanel>

        <StaffDataPanel className="min-w-0 xl:col-span-1">
          <StaffDataPanelHeader
            compact
            accent="info"
            title="Gravedad por reincidencia"
            description="Escala 0 (leve) → 5 (máxima) · incidencias activas"
          />
          <StaffDataPanelBody compact className="space-y-4">
            <div className="grid grid-cols-[auto_1fr] items-center gap-4 border-b border-border/70 pb-4">
              <div className="app-stat-ring">
                <svg className="h-[88px] w-[88px] -rotate-90" aria-hidden>
                  <circle cx="44" cy="44" r="36" stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    stroke={CHART.bar}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${(stats.incidentsThisMonth / Math.max(stats.totalIncidents, 1)) * 226} 226`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums leading-none">{stats.incidentsThisMonth}</span>
                  <span className="text-[10px] text-muted-foreground">mes</span>
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Promedio nivel</dt>
                  <dd className="font-semibold tabular-nums">{stats.averageReincidenceLevel.toFixed(1)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Esta semana</dt>
                  <dd className="font-semibold tabular-nums">{stats.incidentsThisWeek}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Total histórico</dt>
                  <dd className="font-semibold tabular-nums">{stats.totalIncidents}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {REINCIDENCE_LEVELS.map((level) => (
                  <span
                    key={level}
                    className={cn('app-level-pill', `app-level-pill--${level}`)}
                    title={getReincidenceLevelSummaryLabel(level as ReincidenceLevel)}
                  >
                    {level}
                  </span>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Cuántas incidencias activas hay en cada nivel de gravedad. A mayor número, mayor
                seguimiento disciplinario requerido.
              </p>
              <div className="space-y-2">
                {levelDistributionRows.map((item) => {
                  const pct = levelTotal > 0 ? Math.round((item.value / levelTotal) * 100) : 0;
                  const barWidth = levelTotal > 0 ? Math.max(pct, item.value > 0 ? 4 : 0) : 0;
                  return (
                    <div
                      key={item.level}
                      className={cn('rounded-lg border border-border/60 px-2 py-1.5', item.value === 0 && 'opacity-60')}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn('app-level-pill shrink-0', `app-level-pill--${item.level}`)}
                          >
                            Nv. {item.level}
                          </span>
                          <span className="truncate text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {item.value}
                          {levelTotal > 0 && (
                            <span className="ml-1 font-normal text-muted-foreground">({pct}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="app-level-bar-track">
                        <div
                          className="app-level-bar-fill"
                          style={{ width: `${barWidth}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </StaffDataPanelBody>
        </StaffDataPanel>

        <StaffDataPanel className="col-span-full min-w-0">
          <StaffDataPanelHeader
            compact
            accent="success"
            title="Asistencia semanal"
            description="Llegadas registradas · últimos 5 días hábiles"
            action={
              <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                {todayAttendance && (
                  <span className="text-[11px] text-muted-foreground">
                    Hoy: {todayAttendance.onTime} a tiempo · {todayAttendance.late} tarde
                  </span>
                )}
                {attendanceGrowthBadge && (
                  <span className="inline-flex shrink-0 items-center rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm dark:text-emerald-400">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    {attendanceGrowthBadge}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => navigate('/arrival-control')}
                >
                  Ver control
                </Button>
              </div>
            }
          />
          <StaffDataPanelBody
            compact
            className="app-chart-surface app-chart-surface--success !p-0"
          >
            {weeklyAttendance.length === 0 ? (
              <StaffEmptyState
                icon={Clock}
                title="Sin registros de asistencia"
                description="Aún no hay llegadas en los últimos días hábiles."
              />
            ) : (
              <div className="app-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyAttendance} margin={{ ...CHART_MARGIN, top: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="day"
                  stroke={CHART.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                />
                <YAxis
                  stroke={CHART.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: CHART.grid }}
                  allowDecimals={false}
                  domain={[0, attendanceYMax]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      onTime: 'A tiempo',
                      late: 'Tarde',
                      total: 'Total',
                    };
                    return [value, labels[name] ?? name];
                  }}
                  labelFormatter={(label, payload) => {
                    const date = payload?.[0]?.payload?.date as string | undefined;
                    return date ? `${label} · ${date}` : label;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => {
                    const labels: Record<string, string> = {
                      onTime: 'A tiempo',
                      late: 'Tarde',
                    };
                    return labels[value] ?? value;
                  }}
                />
                <Bar
                  dataKey="onTime"
                  stackId="attendance"
                  fill={ATTENDANCE_CHART.onTime}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={48}
                />
                <Bar
                  dataKey="late"
                  stackId="attendance"
                  fill={ATTENDANCE_CHART.late}
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={ATTENDANCE_CHART.total}
                  strokeWidth={2}
                  legendType="none"
                  dot={{
                    r: 4,
                    fill: 'hsl(var(--card))',
                    stroke: ATTENDANCE_CHART.total,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5, fill: ATTENDANCE_CHART.total, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          )}
        </StaffDataPanelBody>
      </StaffDataPanel>
      </div>

      <div className="app-section-grid-2">
        <StaffDataPanel className="h-full">
          <StaffDataPanelHeader
            compact
            accent="warning"
            title="Faltas más frecuentes"
            description="Top 5 del periodo"
          />
          <StaffDataPanelBody compact>
            <div className="app-rank-list">
              {stats.topFaults.slice(0, 5).map((fault, index) => (
                <div key={index} className="app-rank-row">
                  <span className="app-rank-badge">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{fault.faultType}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{fault.count}</span>
                </div>
              ))}
            </div>
          </StaffDataPanelBody>
        </StaffDataPanel>

        <StaffDataPanel>
          <StaffDataPanelHeader
            compact
            accent="accent"
            title="Actividad reciente"
            description="Últimas incidencias"
            action={
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/incidents')}>
                Ver todas
              </Button>
            }
          />
          {recentIncidents.length > 0 ? (
            <div className="app-activity-scroll divide-y divide-border/70">
              {recentIncidents.map((incident) => (
                <StaffActivityItem
                  key={incident.id}
                  title={incident.student?.fullName || 'Estudiante desconocido'}
                  subtitle={incident.faultType?.name || 'Falta desconocida'}
                  meta={format(new Date(incident.registeredAt), "dd MMM yyyy, HH:mm", { locale: es })}
                  onClick={() => navigate('/incidents')}
                    icon={<FileText className="h-4 w-4" />}
                    trailing={
                    <ReincidenceBadge level={incident.reincidenceLevel} short />
                  }
                />
              ))}
            </div>
          ) : (
            <StaffEmptyState
              icon={FileText}
              title="Sin incidencias recientes"
              description="Cuando se registren nuevas faltas aparecerán aquí"
              action={
                <Button size="sm" onClick={() => navigate('/register')}>
                  Registrar incidencia
                </Button>
              }
            />
          )}
        </StaffDataPanel>
      </div>

      {departureAlerts.length > 0 && (
        <StaffSection
          title="Alertas de salida"
          description="Estudiantes con llegada sin salida registrada"
          icon={AlertCircle}
          action={<Badge variant="destructive">{departureAlerts.length}</Badge>}
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {departureAlerts.slice(0, 6).map((alert) => (
              <div
                key={alert.record.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{alert.record.student?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.hoursSinceArrival.toFixed(1)} h sin salida
                    {alert.isCritical && (
                      <span className="ml-1 font-medium text-destructive">· Crítico</span>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="outline-warning" onClick={() => navigate('/departure-control')}>
                  Ir
                </Button>
              </div>
            ))}
          </div>
        </StaffSection>
      )}
    </div>
  );
};
