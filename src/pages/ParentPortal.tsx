import { useState, useEffect, useMemo, useRef } from 'react';
import { useParentPortal } from '@/contexts/ParentPortalContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Phone,
  Mail,
  FileText,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';
import {
  arrivalService,
  authService,
  incidentsService,
  parentMeetingsService,
  evidenceService,
} from '@/lib/services';
import type { ArrivalRecord, Incident, ParentMeeting, Student } from '@/types';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLimaTodayDate, formatDateKeyLima } from '@/lib/utils/limaDateTime';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { ParentBottomNav, type ParentTab } from '@/components/parent/ParentBottomNav';
import { ParentChildrenSwitcher } from '@/components/parent/ParentChildrenSwitcher';
import { cn } from '@/lib/utils';
import { useParentPortalAnimations } from '@/hooks/useParentPortalAnimations';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function parentFriendlyLevel(level: number): string {
  if (level === 0) return 'Sin observaciones recientes';
  if (level <= 2) return 'Seguimiento leve del colegio';
  return 'Requiere atención del colegio';
}

export const ParentPortal = () => {
  const currentUser = authService.getCurrentUser();
  const isParentRole = currentUser?.role === 'Padre';

  const {
    students,
    selectedStudentId,
    setSelectedStudentId,
    student,
    tab,
    setTab,
    loading,
  } = useParentPortal();
  const [arrivalRecords, setArrivalRecords] = useState<ArrivalRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [meetings, setMeetings] = useState<ParentMeeting[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => getLimaTodayDate());
  const [reportMonth, setReportMonth] = useState(() => String(new Date().getMonth()));
  const [reportYear, setReportYear] = useState(() => String(new Date().getFullYear()));
  const pageRef = useRef<HTMLDivElement>(null);

  const portalReady = !loading && students.length > 0;
  useParentPortalAnimations(pageRef, {
    ready: portalReady,
    tab,
    studentId: selectedStudentId,
  });

  useEffect(() => {
    const studentId = Number(selectedStudentId);
    if (!studentId) return;
    let cancelled = false;
    async function load() {
      setLoadingTab(true);
      try {
        const meetingsFrom = formatDateKeyLima(subMonths(new Date(), 12));
        const [a, i, m] = await Promise.all([
          arrivalService.getArrivals({ studentId, limit: 120 }),
          incidentsService.getAll({ estudianteId: studentId, limit: 40 }),
          parentMeetingsService.getAll({
            estudianteId: studentId,
            fechaDesde: meetingsFrom,
            limit: 50,
            offset: 0,
          }),
        ]);
        if (cancelled) return;
        if (!a.error) setArrivalRecords(a.records);
        if (!i.error) setIncidents(i.incidents);
        if (!m.error) setMeetings(m.meetings);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  const today = getLimaTodayDate();
  const todayArrival = useMemo(
    () => arrivalRecords.find((r) => r.date?.slice(0, 10) === today),
    [arrivalRecords, today]
  );

  const filteredArrivalsByDay = useMemo(
    () => arrivalRecords.filter((r) => r.date?.slice(0, 10) === selectedDate),
    [arrivalRecords, selectedDate]
  );

  const monthlyReport = useMemo(() => {
    const month = Number(reportMonth);
    const year = Number(reportYear);
    const start = startOfMonth(new Date(year, month, 1));
    const end = endOfMonth(start);
    const inMonth = arrivalRecords.filter((r) => {
      try {
        if (!r.date) return false;
        return isWithinInterval(parseISO(r.date.slice(0, 10)), { start, end });
      } catch {
        return false;
      }
    });
    const onTime = inMonth.filter((r) => r.status === 'A tiempo').length;
    return {
      total: inMonth.length,
      onTime,
      late: inMonth.filter((r) => r.status === 'Tarde').length,
      punctuality: inMonth.length > 0 ? Math.round((onTime / inMonth.length) * 100) : 0,
      rows: inMonth.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    };
  }, [arrivalRecords, reportMonth, reportYear]);

  const activeIncidents = incidents.filter((i) => i.status === 'Activa');
  const pendingMeetings = meetings.filter((m) => m.estado === 'Pendiente' || m.estado === 'Confirmada');

  const navBadges: Partial<Record<ParentTab, number>> = {
    incidencias: activeIncidents.length,
    citas: pendingMeetings.length,
  };

  if (loading) {
    return (
      <div className="parent-portal-page flex min-h-[50vh] items-center justify-center p-6">
        <PageLoader message="Cargando información de su hijo/a..." />
      </div>
    );
  }

  if (!currentUser || students.length === 0) {
    return (
      <div className="parent-portal-page p-4 sm:p-6">
      <Card className="parent-empty-card border-dashed">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h2 className="text-lg font-semibold">Aún no hay alumno vinculado</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {isParentRole
              ? 'Comuníquese con secretaría del colegio para asociar su cuenta con el DNI de su hijo o hija.'
              : 'Vista de prueba sin estudiantes vinculados.'}
          </p>
        </CardContent>
      </Card>
      </div>
    );
  }

  return (
    <div className="parent-portal-page" ref={pageRef}>
      <div className="parent-portal space-y-4 sm:space-y-5">
      <h1 className="sr-only">Portal familiar</h1>
      {!isParentRole && (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
          Vista de personal — así verá el apoderado
        </p>
      )}

      {/* Hijo/a activo */}
      <section
        className="parent-student-hero overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
        data-parent-hero
        data-parent-anim
      >
        {isParentRole && students.length > 1 && (
          <ParentChildrenSwitcher className="mb-4" />
        )}
        {student && (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
              <StudentPhoto
                src={student.profilePhoto}
                name={student.fullName}
                priority="auto"
                className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-2xl border-2 border-primary/15 shadow-sm sm:h-20 sm:w-20"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold leading-snug tracking-tight sm:text-2xl">
                  {student.fullName}
                </h2>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                  <GraduationCap className="h-4 w-4 shrink-0 text-primary/70" />
                  <span>{student.level}</span>
                  <span className="text-border">·</span>
                  <span>{student.grade}</span>
                  <span className="text-border">·</span>
                  <span>Sección {student.section}</span>
                </p>
                {!isParentRole && (
                  <p className="mt-1 text-xs text-muted-foreground/90">
                    Código{' '}
                    <span className="font-mono font-medium text-foreground/80">{student.barcode}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="w-full rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-card to-accent/10 px-3.5 py-2.5 text-sm shadow-sm lg:max-w-[14rem] lg:shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                Estado
              </p>
              <p className="mt-0.5 font-semibold leading-snug text-foreground">
                {parentFriendlyLevel(student.reincidenceLevel ?? 0)}
              </p>
            </div>
          </div>
        )}
      </section>

      {!isParentRole && students.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={String(s.id) === selectedStudentId ? 'default' : 'outline'}
              onClick={() => setSelectedStudentId(String(s.id))}
            >
              {s.fullName}
            </Button>
          ))}
        </div>
      )}

      <ParentBottomNav value={tab} onChange={setTab} badges={navBadges} />

      <div
        key={`${selectedStudentId}-${tab}`}
        className="parent-tab-panel relative space-y-4 sm:space-y-5"
        data-parent-panel
        data-parent-anim
      >
        {loadingTab && (
          <div
            className="absolute inset-0 z-10 flex min-h-[8rem] items-center justify-center rounded-2xl bg-background/75 backdrop-blur-[2px]"
            aria-live="polite"
            aria-busy="true"
          >
            <PageLoader message="Actualizando datos..." />
          </div>
        )}

      {tab === 'resumen' && (
        <div className="space-y-4 sm:space-y-5">
          <Card className="parent-surface-card overflow-hidden shadow-sm" data-parent-card data-parent-anim>
            <CardContent className="p-0">
              <div className="bg-primary/10 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Hoy</p>
              </div>
              <div className="p-4 sm:p-5">
                {todayArrival ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TodayItem label="Llegada" value={todayArrival.arrivalTime || '—'} />
                    <TodayItem
                      label="Salida"
                      value={todayArrival.departureTime || 'Sin registrar'}
                      warn={!todayArrival.departureTime}
                    />
                    <TodayItem
                      label="Estado"
                      value={todayArrival.status || '—'}
                      ok={todayArrival.status === 'A tiempo'}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay registro de llegada para hoy.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            <ParentStat label="Registros del mes" shortLabel="Registros" value={monthlyReport.total} />
            <ParentStat label="A tiempo" value={monthlyReport.onTime} tone="ok" />
            <ParentStat label="Tardanzas" value={monthlyReport.late} tone="warn" />
            <ParentStat label="Incidencias activas" shortLabel="Incidencias" value={activeIncidents.length} tone="alert" />
          </div>

          {activeIncidents.length > 0 && (
            <Card className="parent-surface-card" data-parent-card data-parent-anim>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Avisos del colegio</CardTitle>
                <CardDescription>Toque Incidencias para ver el detalle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {incidents.slice(0, 2).map((inc) => (
                  <IncidentCard key={inc.id} incident={inc} />
                ))}
                <Button type="button" variant="ghost" className="w-full gap-1" onClick={() => setTab('incidencias')}>
                  Ver todas <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'asistencia' && (
        <div className="space-y-4 sm:space-y-5">
          <Card className="parent-surface-card shadow-sm" data-parent-card data-parent-anim>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">¿Qué pasó un día?</CardTitle>
              <CardDescription>Elija la fecha y vea llegada y salida</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm font-medium">Fecha</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="parent-date-input flex h-12 w-full rounded-xl border border-input bg-background px-4 text-base"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-12 rounded-xl px-6 sm:min-w-[8rem]"
                onClick={() => setSelectedDate(today)}
              >
                Ver hoy
              </Button>
            </CardContent>
          </Card>

          {filteredArrivalsByDay.length === 0 ? (
            <EmptyBlock text="No hay registro de asistencia en esa fecha" />
          ) : (
            <div className="space-y-2">
              {filteredArrivalsByDay.map((r) => (
                <ArrivalCard key={r.id} record={r} />
              ))}
            </div>
          )}

          <Card className="parent-surface-card" data-parent-card data-parent-anim>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen del mes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                <Select value={reportMonth} onValueChange={setReportMonth}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger className="h-11 rounded-xl sm:w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2026].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {monthlyReport.rows.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Sin datos en ese mes</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {monthlyReport.rows.map((r) => (
                    <ArrivalCard key={r.id} record={r} compact />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'incidencias' && (
        <div className="space-y-3 sm:space-y-4">
          <p className="text-sm text-muted-foreground px-1">
            Registro de conducta, uniforme y otras observaciones del colegio.
          </p>
          {incidents.length === 0 ? (
            <EmptyBlock text="No hay incidencias registradas. ¡Buenas noticias!" icon={CheckCircle} />
          ) : (
            incidents.map((inc) => <IncidentCard key={inc.id} incident={inc} detailed />)
          )}
        </div>
      )}

      {tab === 'citas' && (
        <div className="space-y-3 sm:space-y-4">
          <p className="text-sm text-muted-foreground px-1">
            Citas programadas con profesores o dirección.
          </p>
          {meetings.length === 0 ? (
            <EmptyBlock text="No tiene citas programadas por ahora" icon={Calendar} />
          ) : (
            meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)
          )}
        </div>
      )}

      </div>

      <footer className="border-t border-border/50 pt-4 text-center text-xs leading-relaxed text-muted-foreground">
        ¿Consultas? Comuníquese con secretaría del colegio.
        {!isParentRole && student?.contactPhone ? (
          <span className="mt-1 block font-medium text-foreground/80 sm:mt-0 sm:inline">
            {' '}
            · <Phone className="mb-0.5 inline h-3 w-3" aria-hidden /> {student.contactPhone}
          </span>
        ) : null}
      </footer>
      </div>
    </div>
  );
};

function TodayItem({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="parent-metric">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-bold',
          ok && 'text-emerald-600',
          warn && 'text-amber-600'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ParentStat({
  label,
  shortLabel,
  value,
  tone,
}: {
  label: string;
  shortLabel?: string;
  value: number;
  tone?: 'ok' | 'warn' | 'alert';
}) {
  return (
    <div
      className={cn(
        'parent-stat border',
        tone === 'ok' && 'border-emerald-200/90 bg-emerald-50/90',
        tone === 'warn' && 'border-amber-200/90 bg-amber-50/90',
        tone === 'alert' && value > 0 && 'border-red-200/90 bg-red-50/90',
        !tone && 'border-border/80 bg-card'
      )}
      data-parent-stat
      data-parent-anim
    >
      <p className="text-[10px] font-medium leading-snug text-muted-foreground sm:text-[11px]">
        <span className="sm:hidden">{shortLabel ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function ArrivalCard({ record, compact }: { record: ArrivalRecord; compact?: boolean }) {
  const fecha = record.date
    ? format(parseISO(record.date.slice(0, 10)), compact ? 'dd/MM' : 'EEEE d MMM', { locale: es })
    : '—';
  return (
    <div className="parent-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-parent-card data-parent-anim>
      <div className="min-w-0">
        <p className={cn('font-medium capitalize', compact && 'text-sm')}>{fecha}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Llegada <strong className="text-foreground">{record.arrivalTime || '—'}</strong>
          {' · '}
          Salida{' '}
          <strong className={cn(!record.departureTime && 'text-amber-600')}>
            {record.departureTime || 'pendiente'}
          </strong>
        </p>
      </div>
      <Badge
        variant={record.status === 'A tiempo' ? 'default' : 'destructive'}
        className="w-fit shrink-0"
      >
        {record.status}
      </Badge>
    </div>
  );
}

function IncidentCard({ incident, detailed }: { incident: Incident; detailed?: boolean }) {
  const [evidences, setEvidences] = useState<{ url: string; filename: string }[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    if (!detailed || !incident.hasEvidence) {
      setEvidences([]);
      return;
    }
    let cancelled = false;
    setLoadingEvidence(true);
    void evidenceService.getByIncident(incident.id).then(({ evidences: rows, error }) => {
      if (cancelled) return;
      if (!error) {
        setEvidences(rows.map((e) => ({ url: e.url, filename: e.filename })));
      }
      setLoadingEvidence(false);
    });
    return () => {
      cancelled = true;
    };
  }, [detailed, incident.id, incident.hasEvidence]);

  const name = incident.faultType?.name ?? 'Observación registrada';
  const category = incident.faultType?.category;
  const dateStr = incident.registeredAt
    ? format(new Date(incident.registeredAt), "d 'de' MMMM, HH:mm", { locale: es })
    : '';
  const statusLabel =
    incident.status === 'Activa'
      ? 'Pendiente'
      : incident.status === 'Justificada'
        ? 'Justificada'
        : incident.status;

  return (
    <div className="parent-card p-4 sm:p-5" data-parent-card data-parent-anim>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug tracking-tight">{name}</p>
          {category && (
            <p className="mt-0.5 text-xs text-muted-foreground">Categoría: {category}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
          {incident.registeredByUser?.fullName && detailed && (
            <p className="mt-1 text-xs text-muted-foreground">
              Registrado por: {incident.registeredByUser.fullName}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {incident.hasEvidence && (
            <Badge variant="outline" className="text-[10px]">
              Con evidencia
            </Badge>
          )}
          <Badge
            variant={
              incident.status === 'Activa' ? 'destructive' : incident.status === 'Justificada' ? 'default' : 'secondary'
            }
            className="w-fit shrink-0"
          >
            {statusLabel}
          </Badge>
        </div>
      </div>
      {detailed && incident.observations && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground leading-relaxed">
          {incident.observations}
        </p>
      )}
      {detailed && incident.hasEvidence && (
        <div className="mt-3 border-t border-border pt-3">
          {loadingEvidence ? (
            <p className="text-xs text-muted-foreground">Cargando fotos…</p>
          ) : evidences.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {evidences.map((ev) => (
                <a
                  key={ev.url}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border"
                >
                  <img
                    src={ev.url}
                    alt={ev.filename}
                    className="h-20 w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: ParentMeeting }) {
  return (
    <div className="parent-card p-4 sm:p-5" data-parent-card data-parent-anim>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-12 sm:w-12">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{meeting.motivo}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(meeting.fecha), "EEEE d 'de' MMMM", { locale: es })} · {meeting.hora}
          </p>
          <Badge className="mt-2" variant={meeting.estado === 'Cancelada' ? 'destructive' : 'outline'}>
            {meeting.estado}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function EmptyBlock({
  text,
  icon: Icon = FileText,
}: {
  text: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/25 py-14 text-center px-5 sm:py-16">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
