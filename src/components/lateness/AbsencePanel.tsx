import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck, CalendarX, Percent, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffTablePagination,
} from '@/components/staff';
import { useTablePagination } from '@/hooks/useTablePagination';
import type { AbsenceSummary } from '@/lib/utils/absenceStats';
import { normalizeSearchText } from '@/lib/utils/latenessStats';
import { cn } from '@/lib/utils';
import { ABSENCE_TERMS, LatenessHeatmap } from './LatenessHeatmap';
import { LatenessRanking } from './LatenessRanking';
import { LatenessDailyChart } from './LatenessDailyChart';

interface AbsencePanelProps {
  description?: string;
  summary: AbsenceSummary | null;
  isLoading: boolean;
  isError: boolean;
  isFetching?: boolean;
  onRetry: () => void;
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'hsl(var(--abs-1))', color: 'hsl(var(--abs-5))' }}
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

function SubTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h4 className="text-sm font-semibold text-foreground">{children}</h4>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Faltas por grado y sección, aulas con más faltas, faltas por día y lista de estudiantes. */
export function AbsencePanel({ description, summary, isLoading, isError, isFetching = false, onRetry }: AbsencePanelProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const selected = summary?.classrooms.find((c) => c.key === selectedKey) ?? null;
  const top = useMemo(
    () => (summary ? [...summary.classrooms].sort((a, b) => b.lateCount - a.lateCount)[0] : null),
    [summary],
  );

  const students = useMemo(() => {
    const q = normalizeSearchText(query);
    return (summary?.students ?? []).filter(
      (s) => s.absences > 0 && (!selected || s.classroomKey === selected.key) && (!q || normalizeSearchText(s.studentName).includes(q)),
    );
  }, [summary, selected, query]);
  const pag = useTablePagination({ totalItems: students.length });
  useEffect(() => {
    pag.resetPage();
  }, [query, selectedKey, summary]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = students.slice(pag.sliceRange.start, pag.sliceRange.end);
  const maxAbs = Math.max(1, ...students.map((s) => s.absences));

  let body: React.ReactNode;
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
        icon={CalendarX}
        title="No se pudieron cargar las faltas"
        description="Puede ser un problema temporal de conexión."
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    );
  } else if (summary.schoolDays.length === 0) {
    body = (
      <StaffEmptyState
        icon={CalendarCheck}
        title="Sin días con clases en el período"
        description="Solo se cuentan los días hábiles ya cerrados en los que se tomó asistencia."
      />
    );
  } else {
    body = (
      <div className={cn('space-y-6 transition-opacity', isFetching && 'opacity-60')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={CalendarX}
            label="Faltas"
            value={summary.totalAbsences}
            hint={summary.justified > 0 ? `${summary.justified} justificadas` : 'Ninguna justificada'}
          />
          <Stat icon={Users} label="Alumnos con faltas" value={summary.studentsWithAbsences} hint={`de ${summary.students.length} activos`} />
          <Stat
            icon={Percent}
            label="Asistencia"
            value={summary.attendanceRate == null ? '—' : `${(summary.attendanceRate * 100).toFixed(1)}%`}
            hint={top && top.lateCount > 0 ? `Más faltas: ${top.label}` : undefined}
          />
          <Stat
            icon={CalendarCheck}
            label="Días con clases"
            value={summary.schoolDays.length}
            hint={`${format(parseISO(summary.schoolDays[0]), 'dd/MM')} al ${format(parseISO(summary.schoolDays[summary.schoolDays.length - 1]), 'dd/MM')}`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <section className="min-w-0 xl:col-span-3">
            <SubTitle hint="Toque un aula para ver sus alumnos">Faltas por grado y sección</SubTitle>
            <LatenessHeatmap
              grades={summary.grades}
              sections={summary.sections}
              max={summary.maxClassroomAbsences}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              terms={ABSENCE_TERMS}
            />
          </section>
          <section className="min-w-0 xl:col-span-2">
            <SubTitle>Aulas con más faltas</SubTitle>
            <LatenessRanking
              classrooms={summary.classrooms}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              terms={ABSENCE_TERMS}
            />
          </section>
        </div>

        {summary.days.length > 1 && (
          <section className="min-w-0">
            <SubTitle hint="Solo días con clases">Faltas por día</SubTitle>
            <LatenessDailyChart days={summary.days} terms={ABSENCE_TERMS} />
          </section>
        )}

        <section className="min-w-0 space-y-3">
          <SubTitle>Alumnos con faltas</SubTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alumno…" className="h-9 pl-8" aria-label="Buscar alumno con faltas" />
            </div>
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="inline-flex items-center gap-1 self-start rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                Aula {selected.label}
                <X className="h-3 w-3" aria-label="Quitar filtro de aula" />
              </button>
            )}
          </div>
          {students.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              {query ? 'Ningún alumno coincide con la búsqueda' : 'Nadie faltó en este período'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Alumno</th>
                      <th className="px-3 py-2 text-left font-medium">Aula</th>
                      <th className="px-3 py-2 text-left font-medium">Faltas</th>
                      <th className="px-3 py-2 text-right font-medium">Asistencia</th>
                      <th className="px-3 py-2 text-right font-medium">Última falta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map((s) => (
                      <tr key={s.studentId} className="hover:bg-muted/40">
                        <td className="px-3 py-2 font-medium text-foreground">{s.studentName}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{s.classroomLabel}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${(s.absences / maxAbs) * 100}%`, backgroundColor: 'hsl(var(--abs-4))' }} />
                            </div>
                            <span className="font-semibold tabular-nums text-foreground">{s.absences}</span>
                            {s.justified > 0 && <span className="text-[11px] text-muted-foreground">({s.justified} justif.)</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{(s.attendanceRate * 100).toFixed(0)}%</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {s.lastAbsence ? format(parseISO(s.lastAbsence), 'EEE dd MMM', { locale: es }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <StaffTablePagination
                page={pag.page}
                totalPages={pag.totalPages}
                pageSize={pag.pageSize}
                totalItems={students.length}
                onPrev={pag.prevPage}
                onNext={pag.nextPage}
                onGoToPage={pag.goToPage}
                onPageSizeChange={pag.changePageSize}
                className="!mt-3"
              />
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <StaffDataPanel className="col-span-full min-w-0">
      <StaffDataPanelHeader compact accent="secondary" title="Faltas de asistencia por grado y sección" description={description} />
      <StaffDataPanelBody>{body}</StaffDataPanelBody>
    </StaffDataPanel>
  );
}
