import { useMemo, useState, type ReactNode } from 'react';
import { AlarmClock, ArrowRight, Clock, Percent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffEmptyState,
  type StaffPanelAccent,
} from '@/components/staff';
import type { LatenessClassroom, LatenessStudent, LatenessSummary } from '@/lib/utils/latenessStats';
import { cn } from '@/lib/utils';
import { LatenessHeatmap } from './LatenessHeatmap';
import { LatenessRanking } from './LatenessRanking';
import { LatenessDailyChart } from './LatenessDailyChart';
import { LatenessStudentsList } from './LatenessStudentsList';
import { DonutChart } from './DonutChart';
import { DELAY_COLORS, JUSTIFICATION_COLORS, LEVEL_COLORS, LEVEL_FALLBACK_COLOR } from './latenessColors';

interface LatenessPanelProps {
  title?: string;
  description?: string;
  accent?: StaffPanelAccent;
  summary: LatenessSummary | null;
  isLoading: boolean;
  isError: boolean;
  isFetching?: boolean;
  onRetry: () => void;
  headerAction?: ReactNode;
  /** Barras de tardanzas por día (útil en períodos largos). */
  showDaily?: boolean;
  /** El período es un solo día: la lista muestra la hora de llegada. */
  singleDay?: boolean;
  /** Versión resumida (Inicio): cifras, mapa y los alumnos con más tardanzas. */
  compact?: boolean;
  /** Botón «Ver reporte completo» al pie (solo en la versión resumida). */
  onOpenFullReport?: () => void;
  className?: string;
}

const TOP_STUDENTS = 5;

function TopStudents({
  students,
  selectedClassroom,
  onClearClassroom,
  singleDay,
}: {
  students: LatenessStudent[];
  selectedClassroom: LatenessClassroom | null;
  onClearClassroom: () => void;
  singleDay: boolean;
}) {
  const list = students.filter((s) => !selectedClassroom || s.classroomKey === selectedClassroom.key);
  const top = list.slice(0, TOP_STUDENTS);

  return (
    <div>
      {selectedClassroom && (
        <button
          type="button"
          onClick={onClearClassroom}
          className="mb-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          Aula {selectedClassroom.label} ✕
        </button>
      )}
      {top.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Nadie llegó tarde
        </p>
      ) : (
        <ol className="divide-y rounded-xl border">
          {top.map((s) => (
            <li key={s.studentId} className="flex items-center gap-3 px-3 py-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: 'hsl(var(--late-1))', color: 'hsl(var(--late-text-1))' }}
                aria-hidden
              >
                {s.studentName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{s.studentName}</p>
                <p className="text-xs text-muted-foreground">{s.classroomLabel}</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-foreground">
                  {singleDay ? s.lastTime || '—' : s.lateCount}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {singleDay ? 'llegó' : s.lateCount === 1 ? 'tardanza' : 'tardanzas'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {list.length > TOP_STUDENTS && (
        <p className="mt-2 text-xs text-muted-foreground">y {list.length - TOP_STUDENTS} alumnos más</p>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'hsl(var(--late-1))', color: 'hsl(var(--late-5))' }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight tabular-nums text-foreground">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function SubTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h4 className="text-sm font-semibold text-foreground">{children}</h4>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function formatMinutes(m: number | null): string {
  if (m == null) return '—';
  return `${Math.round(m)} min`;
}

export function LatenessPanel({
  title = 'Tardanzas por grado y sección',
  description,
  accent = 'warning',
  summary,
  isLoading,
  isError,
  isFetching = false,
  onRetry,
  headerAction,
  showDaily = false,
  singleDay = false,
  compact = false,
  onOpenFullReport,
  className,
}: LatenessPanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedClassroom = useMemo(
    () => summary?.classrooms.find((c) => c.key === selectedKey) ?? null,
    [summary, selectedKey],
  );

  const topClassroom = useMemo(() => {
    if (!summary) return null;
    return [...summary.classrooms].sort((a, b) => b.lateCount - a.lateCount)[0] ?? null;
  }, [summary]);

  let body: ReactNode;
  if (isLoading && !summary) {
    body = (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    );
  } else if (isError || !summary) {
    body = (
      <StaffEmptyState
        icon={AlarmClock}
        title="No se pudieron cargar las tardanzas"
        description="Puede ser un problema temporal de conexión."
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    );
  } else if (summary.classrooms.length === 0) {
    body = (
      <StaffEmptyState
        icon={AlarmClock}
        title="Sin aulas para mostrar"
        description="No hay alumnos activos ni tardanzas con los filtros elegidos."
      />
    );
  } else if (compact) {
    body = (
      <div className={cn('space-y-5 transition-opacity', isFetching && 'opacity-60')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniStat
            icon={AlarmClock}
            label="Tardanzas"
            value={summary.totalLate}
            hint={summary.justified > 0 ? `${summary.justified} justificadas` : 'Ninguna justificada'}
          />
          <MiniStat
            icon={Users}
            label="Alumnos"
            value={summary.studentsLate}
            hint={summary.studentsLate === 1 ? 'llegó tarde' : 'llegaron tarde'}
          />
          <MiniStat
            icon={Percent}
            label="De las llegadas"
            value={summary.lateRate == null ? '—' : `${(summary.lateRate * 100).toFixed(1)}%`}
            hint={
              topClassroom && topClassroom.lateCount > 0 ? `Más tardanzas: ${topClassroom.label}` : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <section className="min-w-0 xl:col-span-3">
            <SubTitle hint="Toque un aula para ver sus alumnos">Por grado y sección</SubTitle>
            <LatenessHeatmap
              dense
              grades={summary.grades}
              sections={summary.sections}
              max={summary.maxClassroomLate}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </section>
          <section className="min-w-0 xl:col-span-2">
            <SubTitle>{singleDay ? 'Llegaron tarde hoy' : 'Con más tardanzas'}</SubTitle>
            <TopStudents
              students={summary.students}
              selectedClassroom={selectedClassroom}
              onClearClassroom={() => setSelectedKey(null)}
              singleDay={singleDay}
            />
          </section>
        </div>
      </div>
    );
  } else {
    body = (
      <div className={cn('space-y-6 transition-opacity', isFetching && 'opacity-60')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat
            icon={AlarmClock}
            label="Tardanzas"
            value={summary.totalLate}
            hint={summary.justified > 0 ? `${summary.justified} justificadas` : 'Ninguna justificada'}
          />
          <MiniStat
            icon={Users}
            label="Alumnos"
            value={summary.studentsLate}
            hint={summary.studentsLate === 1 ? 'llegó tarde' : 'llegaron tarde'}
          />
          <MiniStat
            icon={Percent}
            label="De las llegadas"
            value={summary.lateRate == null ? '—' : `${(summary.lateRate * 100).toFixed(1)}%`}
            hint={
              summary.arrivalsTotal != null
                ? `${summary.arrivalsTotal.toLocaleString('es-PE')} llegadas registradas`
                : undefined
            }
          />
          <MiniStat
            icon={Clock}
            label="Retraso promedio"
            value={formatMinutes(summary.avgMinutesLate)}
            hint={
              topClassroom && topClassroom.lateCount > 0
                ? `Más tardanzas: ${topClassroom.label}`
                : undefined
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <section className="min-w-0 xl:col-span-3">
            <SubTitle hint="Pase el cursor o toque un aula">Mapa por grado y sección</SubTitle>
            <LatenessHeatmap
              grades={summary.grades}
              sections={summary.sections}
              max={summary.maxClassroomLate}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </section>
          <section className="min-w-0 xl:col-span-2">
            <SubTitle>Aulas con más tardanzas</SubTitle>
            <LatenessRanking
              classrooms={summary.classrooms}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </section>
        </div>

        {summary.totalLate > 0 && (
          <section className="min-w-0">
            <SubTitle>Composición de las tardanzas</SubTitle>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Por nivel</p>
                <DonutChart
                  centerLabel="tardanzas"
                  size={128}
                  data={summary.byLevel.map((s) => ({
                    ...s,
                    color: LEVEL_COLORS[s.key] ?? LEVEL_FALLBACK_COLOR,
                  }))}
                />
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Justificación</p>
                <DonutChart
                  centerLabel="tardanzas"
                  size={128}
                  data={[
                    {
                      key: 'pending',
                      label: 'Sin justificar',
                      value: summary.totalLate - summary.justified,
                      color: JUSTIFICATION_COLORS.pending,
                    },
                    {
                      key: 'justified',
                      label: 'Justificadas',
                      value: summary.justified,
                      color: JUSTIFICATION_COLORS.justified,
                    },
                  ]}
                />
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Minutos de retraso</p>
                <DonutChart
                  centerLabel="con hora"
                  size={128}
                  data={summary.byDelay.map((s, i) => ({ ...s, color: DELAY_COLORS[i] }))}
                />
              </div>
            </div>
          </section>
        )}

        {showDaily && summary.days.length > 1 && (
          <section className="min-w-0">
            <SubTitle hint="Solo días con tardanzas">Tardanzas por día</SubTitle>
            <LatenessDailyChart days={summary.days} />
          </section>
        )}

        <section className="min-w-0">
          <SubTitle>{singleDay ? 'Quiénes llegaron tarde' : 'Alumnos que llegaron tarde'}</SubTitle>
          <LatenessStudentsList
            students={summary.students}
            selectedClassroom={selectedClassroom}
            onClearClassroom={() => setSelectedKey(null)}
            singleDay={singleDay}
          />
        </section>
      </div>
    );
  }

  return (
    <StaffDataPanel className={cn('col-span-full min-w-0', className)}>
      <StaffDataPanelHeader compact accent={accent} title={title} description={description} action={headerAction} />
      <StaffDataPanelBody>{body}</StaffDataPanelBody>
      {compact && onOpenFullReport && (
        <div className="flex justify-end border-t border-border/70 px-4 py-3 sm:px-5">
          <Button size="sm" onClick={onOpenFullReport}>
            Ver reporte completo
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </StaffDataPanel>
  );
}
