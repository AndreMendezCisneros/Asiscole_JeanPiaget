import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, DoorOpen, RefreshCw, Search, UserX, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { StaffDataPanel, StaffDataPanelHeader, StaffEmptyState, StaffKpiStat } from '@/components/staff';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { PageLoader } from '@/components/ui/page-loader';
import { tutorAulaService } from '@/lib/services/tutorAulaService';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { resolveReportStatusForDay } from '@/lib/utils/attendanceJustification';
import type { AttendanceStatus } from '@/types';
import type { TutorDayStudent } from '@/types/tutorAula';
import type { TutorAulaContext } from '@/components/layout/TutorAulaLayout';

type Mode = 'llegada' | 'salida';

const STATUS_BADGE: Record<AttendanceStatus, { label: string; variant: BadgeProps['variant'] }> = {
  A_tiempo: { label: 'A tiempo', variant: 'success' },
  Tarde: { label: 'Tarde', variant: 'warning' },
  Tarde_justificada: { label: 'Tarde justificada', variant: 'info' },
  Justificada: { label: 'Justificada', variant: 'info' },
  Inasistencia_justificada: { label: 'Falta justificada', variant: 'info' },
  Injustificada: { label: 'Faltó', variant: 'destructive' },
  Sin_registro: { label: 'Sin marcar', variant: 'outline' },
};

function hhmm(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '—';
}

function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function dayStatus(s: TutorDayStudent, date: string, today: string): AttendanceStatus {
  return resolveReportStatusForDay(date, s.arrival?.status, today, {
    hasRecord: Boolean(s.arrival),
    arrivalTime: s.arrival?.arrivalTime,
  });
}

function arrived(status: AttendanceStatus): boolean {
  return status === 'A_tiempo' || status === 'Tarde' || status === 'Tarde_justificada' || status === 'Justificada';
}

/** Control de llegada o de salida del salón, solo lectura. */
export function TutorAulaDia({ mode }: { mode: Mode }) {
  const { salon } = useOutletContext<TutorAulaContext>();
  const today = getLimaTodayDate();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState('');

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['tutor-aula', 'dia', date],
    queryFn: async () => {
      const res = await tutorAulaService.getDay(date);
      if (res.error) throw new Error(res.error);
      return res.students;
    },
    staleTime: 60 * 1000,
    // Hoy se actualiza solo cada 2 min; los días pasados no cambian.
    refetchInterval: date === today ? 2 * 60 * 1000 : false,
  });

  const rows = useMemo(
    () => (data ?? []).map((s) => ({ student: s, status: dayStatus(s, date, today) })),
    [data, date, today],
  );

  const stats = useMemo(() => {
    const present = rows.filter((r) => arrived(r.status));
    return {
      total: rows.length,
      onTime: rows.filter((r) => r.status === 'A_tiempo').length,
      late: rows.filter((r) => r.status === 'Tarde' || r.status === 'Tarde_justificada').length,
      absent: rows.filter((r) => r.status === 'Injustificada' || r.status === 'Sin_registro').length,
      present: present.length,
      left: present.filter((r) => r.student.arrival?.departureTime).length,
      authorized: present.filter((r) => r.student.arrival?.departureType === 'Autorizada').length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const terms = foldText(search.trim()).split(/\s+/).filter(Boolean);
    const base = mode === 'salida' ? rows.filter((r) => arrived(r.status)) : rows;
    if (terms.length === 0) return base;
    return base.filter((r) => {
      const name = foldText(r.student.fullName);
      return terms.every((t) => name.includes(t));
    });
  }, [rows, search, mode]);

  const title = mode === 'llegada' ? 'Control de llegada' : 'Control de salida';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tutor-dia-fecha">Fecha</Label>
          <Input
            id="tutor-dia-fecha"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            className="w-44"
          />
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="tutor-dia-buscar">Buscar alumno</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="tutor-dia-buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre..."
              className="pl-10"
            />
          </div>
        </div>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar
        </Button>
      </div>

      {mode === 'llegada' ? (
        <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
          <StaffKpiStat label="Alumnos" value={stats.total} icon={Users} tone="primary" />
          <StaffKpiStat label="A tiempo" value={stats.onTime} icon={CheckCircle2} tone="success" />
          <StaffKpiStat label="Tarde" value={stats.late} icon={Clock} tone="warning" />
          <StaffKpiStat
            label={date < today ? 'Faltaron' : 'Sin marcar'}
            value={stats.absent}
            icon={UserX}
            tone="secondary"
          />
        </div>
      ) : (
        <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
          <StaffKpiStat label="Asistieron" value={stats.present} icon={Users} tone="primary" />
          <StaffKpiStat label="Ya salieron" value={stats.left} icon={DoorOpen} tone="success" />
          <StaffKpiStat label="Aún sin salida" value={stats.present - stats.left} icon={Clock} tone="warning" />
          <StaffKpiStat label="Salida autorizada" value={stats.authorized} icon={CheckCircle2} tone="info" />
        </div>
      )}

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`${title} (${visible.length})`}
          description={`${salon.grade} ${salon.section} · ${salon.level} · Solo lectura`}
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0" aria-live="polite">
          {isLoading ? (
            <PageLoader message="Cargando..." />
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error instanceof Error ? error.message : 'No se pudo cargar'}
            </p>
          ) : visible.length === 0 ? (
            <StaffEmptyState
              icon={mode === 'llegada' ? Users : DoorOpen}
              title="Sin alumnos para mostrar"
              description={mode === 'salida' ? 'Nadie registró llegada ese día' : 'Pruebe otro nombre'}
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {visible.map(({ student, status }) => {
                const badge = STATUS_BADGE[status];
                const a = student.arrival;
                return (
                  <li key={student.id} className="flex items-center gap-3 py-2.5">
                    <StudentPhoto src={student.photo} name={student.fullName} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{student.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {mode === 'llegada'
                          ? `Llegada ${hhmm(a?.arrivalTime)}`
                          : `Llegada ${hhmm(a?.arrivalTime)} · Salida ${hhmm(a?.departureTime)}`}
                        {a?.justification ? ` · ${a.justification}` : ''}
                      </p>
                    </div>
                    {mode === 'llegada' ? (
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    ) : a?.departureTime ? (
                      <Badge variant={a.departureType === 'Autorizada' ? 'info' : 'success'}>
                        {a.departureType === 'Autorizada' ? 'Autorizada' : 'Salió'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sin salida</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
}

export const TutorAulaLlegada = () => <TutorAulaDia mode="llegada" />;
export const TutorAulaSalida = () => <TutorAulaDia mode="salida" />;
