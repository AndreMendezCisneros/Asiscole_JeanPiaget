import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { arrivalService, holidaysService, incidentsService, tallerAttendanceService } from '@/lib/services';
import { isTalleresEnabled } from '@/config/features';
import type { ArrivalRecord, Incident, Student, TallerAsistencia } from '@/types';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { getLimaMonthBounds, getLimaTodayDate, getMonthBounds } from '@/lib/utils/limaDateTime';
import {
  buildMonthGrid,
  computeMonthMetrics,
  DAY_STYLES,
  dayHasIncident,
  dayHasTaller,
  dayDetailCopy,
  formatClassAttendanceLines,
  formatClassIncidentDayDetail,
  formatTallerIncidentDayDetail,
  firstName,
  formatTallerDayDetail,
  parseArrivalTime12h,
  resolveDayStatus,
  topStripGradient,
  WEEKDAY_LABELS,
  type DayStatus,
} from '@/lib/utils/parentAttendanceCalendar';
import { cn } from '@/lib/utils';

interface ParentAttendanceDashboardProps {
  student: Student;
  /** Llegada de hoy (enlace WhatsApp o consulta DNI). */
  todayArrival?: ArrivalRecord | null;
  /** Registros del mes inicial (evita parpadeo). */
  initialMonthArrivals?: ArrivalRecord[];
}

function chunkWeeks(cells: (string | null)[]): (string | null)[][] {
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function ParentAttendanceDashboard({
  student,
  todayArrival = null,
  initialMonthArrivals = [],
}: ParentAttendanceDashboardProps) {
  const todayKey = getLimaTodayDate();
  const current = getLimaMonthBounds();
  const talleresEnabled = isTalleresEnabled();

  const [viewYear, setViewYear] = useState(current.year);
  const [viewMonth, setViewMonth] = useState(current.month);
  const [monthArrivals, setMonthArrivals] = useState<ArrivalRecord[]>(initialMonthArrivals);
  const [monthTallerAttendance, setMonthTallerAttendance] = useState<TallerAsistencia[]>([]);
  const [monthClassIncidents, setMonthClassIncidents] = useState<Incident[]>([]);
  const [monthTallerIncidents, setMonthTallerIncidents] = useState<Incident[]>([]);
  const [holidayNames, setHolidayNames] = useState<Map<string, string>>(new Map());
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadMonth = useCallback(
    async (year: number, month: number) => {
      setLoadingMonth(true);
      try {
        const { start, end } = getMonthBounds(year, month);
        const [arrivals, tallerResponse, incidentsResponse, holidaysResponse] = await Promise.all([
          arrivalService.fetchMonthArrivalsForStudent(student.id, year, month),
          talleresEnabled
            ? tallerAttendanceService.fetchMonthForStudent(student.id, year, month)
            : Promise.resolve<{ records: TallerAsistencia[]; error: string | null }>({
                records: [],
                error: null,
              }),
          incidentsService.getAll({
            estudianteId: student.id,
            fechaDesde: `${start}T00:00:00.000-05:00`,
            fechaHasta: `${end}T23:59:59.999-05:00`,
            fetchAll: true,
          }),
          holidaysService.listActiveInRange(start, end),
        ]);

        setMonthArrivals(arrivals);
        setMonthTallerAttendance(tallerResponse.records);
        const incidents = incidentsResponse.incidents;
        setMonthClassIncidents(incidents.filter((incident) => !incident.tallerId));
        setMonthTallerIncidents(incidents.filter((incident) => Boolean(incident.tallerId)));
        setHolidayNames(new Map(holidaysResponse.items.map((h) => [h.fecha, h.nombre])));
      } finally {
        setLoadingMonth(false);
      }
    },
    [student.id, talleresEnabled]
  );

  useEffect(() => {
    const isInitial =
      viewYear === current.year &&
      viewMonth === current.month &&
      initialMonthArrivals.length > 0;
    if (isInitial) {
      setMonthArrivals(initialMonthArrivals);
      const { start, end } = getMonthBounds(viewYear, viewMonth);
      setLoadingMonth(true);
      void Promise.all([
        talleresEnabled
          ? tallerAttendanceService.fetchMonthForStudent(student.id, viewYear, viewMonth)
          : Promise.resolve<{ records: TallerAsistencia[]; error: string | null }>({
              records: [],
              error: null,
            }),
        incidentsService.getAll({
          estudianteId: student.id,
          fechaDesde: `${start}T00:00:00.000-05:00`,
          fechaHasta: `${end}T23:59:59.999-05:00`,
          fetchAll: true,
        }),
        holidaysService.listActiveInRange(start, end),
      ])
        .then(([attendanceResponse, incidentsResponse, holidaysResponse]) => {
          setMonthTallerAttendance(attendanceResponse.records);
          const incidents = incidentsResponse.incidents;
          setMonthClassIncidents(incidents.filter((incident) => !incident.tallerId));
          setMonthTallerIncidents(incidents.filter((incident) => Boolean(incident.tallerId)));
          setHolidayNames(new Map(holidaysResponse.items.map((h) => [h.fecha, h.nombre])));
        })
        .finally(() => setLoadingMonth(false));
      return;
    }
    void loadMonth(viewYear, viewMonth);
  }, [
    viewYear,
    viewMonth,
    current.year,
    current.month,
    initialMonthArrivals,
    loadMonth,
    student.id,
    talleresEnabled,
  ]);

  const byDate = useMemo(() => {
    const map = new Map(monthArrivals.map((a) => [a.date, a]));
    if (todayArrival && todayArrival.date.startsWith(`${viewYear}-${String(viewMonth).padStart(2, '0')}`)) {
      map.set(todayArrival.date, todayArrival);
    }
    return map;
  }, [monthArrivals, todayArrival, viewYear, viewMonth]);

  const tallerByDate = useMemo(() => {
    const map = new Map<string, TallerAsistencia[]>();
    monthTallerAttendance.forEach((record) => {
      const rows = map.get(record.date) ?? [];
      rows.push(record);
      map.set(record.date, rows);
    });
    return map;
  }, [monthTallerAttendance]);

  const classIncidentsByDate = useMemo(() => {
    const map = new Map<string, Incident[]>();
    monthClassIncidents.forEach((incident) => {
      const dateKey = incident.registeredAt?.slice(0, 10);
      if (!dateKey) return;
      const rows = map.get(dateKey) ?? [];
      rows.push(incident);
      map.set(dateKey, rows);
    });
    return map;
  }, [monthClassIncidents]);

  const tallerIncidentsByDate = useMemo(() => {
    const map = new Map<string, Incident[]>();
    monthTallerIncidents.forEach((incident) => {
      const dateKey = incident.registeredAt?.slice(0, 10);
      if (!dateKey) return;
      const rows = map.get(dateKey) ?? [];
      rows.push(incident);
      map.set(dateKey, rows);
    });
    return map;
  }, [monthTallerIncidents]);

  const metrics = useMemo(
    () => computeMonthMetrics(viewYear, viewMonth, byDate, todayKey, holidayNames),
    [viewYear, viewMonth, byDate, todayKey, holidayNames]
  );

  const stripGradient = topStripGradient(metrics.present, metrics.late, metrics.absent);
  const cells = buildMonthGrid(viewYear, viewMonth);
  const weeks = chunkWeeks(cells);
  const monthTitle = format(new Date(viewYear, viewMonth - 1, 1), 'MMMM yyyy', { locale: es });
  const studentFirst = firstName(student.fullName);
  const nivel = [student.level, student.grade, student.section].filter(Boolean).join(' · ');

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
    setSelectedDay(null);
  };

  const selectedStatus = selectedDay
    ? resolveDayStatus(selectedDay, byDate.get(selectedDay), todayKey, holidayNames)
    : null;
  const selectedRecord = selectedDay ? byDate.get(selectedDay) : undefined;
  const selectedHolidayName = selectedDay ? holidayNames.get(selectedDay) : undefined;
  const selectedTallerRows = selectedDay ? tallerByDate.get(selectedDay) ?? [] : [];
  const selectedClassIncidentRows = selectedDay ? classIncidentsByDate.get(selectedDay) ?? [] : [];
  const selectedTallerIncidentRows = selectedDay ? tallerIncidentsByDate.get(selectedDay) ?? [] : [];
  const selectedClassLines = useMemo(
    () => formatClassAttendanceLines(selectedRecord),
    [selectedRecord]
  );
  const selectedClassIncidentLines = useMemo(
    () => formatClassIncidentDayDetail(selectedClassIncidentRows),
    [selectedClassIncidentRows]
  );
  const selectedTallerLines = useMemo(
    () => formatTallerDayDetail(selectedTallerRows),
    [selectedTallerRows]
  );
  const selectedTallerIncidentLines = useMemo(
    () => formatTallerIncidentDayDetail(selectedTallerIncidentRows),
    [selectedTallerIncidentRows]
  );
  const detail =
    selectedDay && selectedStatus
      ? dayDetailCopy(
          selectedStatus,
          studentFirst,
          selectedRecord ? parseArrivalTime12h(selectedRecord.arrivalTime) : undefined,
          selectedRecord?.departureTime,
          selectedHolidayName,
        )
      : null;

  const hideAbsent = import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD === 'true';

  const metricCards = [
    { key: 'present' as const, label: 'Días presentes', value: metrics.present },
    { key: 'late' as const, label: 'Tardanzas', value: metrics.late },
    // Con flag blank: ocultar KPI solo si no hay faltas reales (estado Falta en BD)
    ...(hideAbsent && metrics.absent === 0
      ? []
      : [{ key: 'absent' as const, label: 'Faltas', value: metrics.absent }]),
  ];

  return (
    <article
      className="w-full max-w-[480px] overflow-hidden rounded-[14px] border border-[#E8EAF0] bg-white"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="h-1.5 rounded-t-[14px]" style={{ background: stripGradient }} aria-hidden />

      <div className="p-6">
        {/* Perfil */}
        <div className="flex flex-col items-center text-center">
          <StudentPhoto
            src={student.profilePhoto ?? null}
            name={student.fullName}
            priority="auto"
            className="h-36 w-36 shrink-0 rounded-2xl border border-[#E8EAF0] bg-[#F1F2F5] sm:h-40 sm:w-40"
            imageClassName="object-cover rounded-2xl"
            fallbackClassName="rounded-2xl bg-[#F1F2F5] text-2xl font-semibold text-[#6B7280] sm:text-3xl"
          />
          <h1 className="mt-3 text-xl font-semibold text-[#1A1D23] leading-snug">{student.fullName}</h1>
          {nivel && <p className="mt-1 text-[13px] text-[#6B7280]">{nivel}</p>}
        </div>

        <div className="my-5 h-px w-full bg-[#E8EAF0]" />

        {/* Métricas */}
        <div className={`grid gap-2.5 ${hideAbsent ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {metricCards.map(({ key, label, value }) => {
            const s = DAY_STYLES[key === 'present' ? 'present' : key === 'late' ? 'late' : 'absent'];
            return (
              <div
                key={key}
                className="rounded-[10px] border px-2.5 py-3.5 text-center"
                style={{ background: s.bg, borderColor: s.border }}
              >
                <p className="text-[28px] font-semibold leading-none" style={{ color: s.text }}>
                  {value}
                </p>
                <p
                  className="mt-1 text-[10px] font-medium uppercase tracking-[0.06em]"
                  style={{ color: s.text }}
                >
                  {label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Calendario */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8EAF0] bg-white text-base text-[#6B7280] hover:bg-[#F1F2F5]"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className="text-[15px] font-semibold capitalize text-[#1A1D23]">{monthTitle}</p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E8EAF0] bg-white text-base text-[#6B7280] hover:bg-[#F1F2F5]"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.05em] text-[#9095A3]"
              >
                {label}
              </div>
            ))}
          </div>

          <div className={cn('space-y-1', loadingMonth && 'opacity-60 pointer-events-none')}>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((dayKey, di) => {
                  if (!dayKey) {
                    return (
                      <div
                        key={`e-${wi}-${di}`}
                        className="min-h-[44px] sm:min-h-[52px]"
                        aria-hidden
                      />
                    );
                  }

                  const status = resolveDayStatus(dayKey, byDate.get(dayKey), todayKey, holidayNames);
                  const style = DAY_STYLES[status];
                  const isToday = dayKey === todayKey;
                  const isSelected = selectedDay === dayKey;
                  const dayNum = format(parseISO(dayKey), 'd', { locale: es });

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                      className={cn(
                        'relative flex min-h-[44px] flex-col items-center justify-center rounded-[10px] border px-0.5 py-1 sm:min-h-[52px]',
                        isToday && 'outline outline-2 outline-[#3B82F6] outline-offset-2 bg-white'
                      )}
                      style={{
                        background: isToday ? '#FFFFFF' : style.bg,
                        borderColor: style.border,
                        color: style.text,
                      }}
                      aria-label={format(parseISO(dayKey), "d 'de' MMMM", { locale: es })}
                      aria-pressed={isSelected}
                    >
                      {dayHasTaller(tallerByDate, dayKey) && (
                        <span
                          className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[9px] font-semibold leading-none"
                          style={{
                            background: '#EFF6FF',
                            color: '#1D4ED8',
                            borderColor: '#BFDBFE',
                          }}
                          aria-label="Tiene taller"
                        >
                          T
                        </span>
                      )}
                      {(dayHasIncident(classIncidentsByDate, dayKey) ||
                        dayHasIncident(tallerIncidentsByDate, dayKey)) && (
                        <span
                          className="absolute left-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[9px] font-semibold leading-none"
                          style={{
                            background: '#FEF3C7',
                            color: '#92400E',
                            borderColor: '#FCD34D',
                          }}
                          aria-label="Tiene incidencia"
                        >
                          i
                        </span>
                      )}
                      <span
                        className="text-[13px] font-medium leading-none"
                        style={{ color: isToday ? '#1D4ED8' : style.text }}
                      >
                        {dayNum}
                      </span>
                      {style.icon && (
                        <span className="mt-0.5 text-[10px] leading-none" aria-hidden>
                          {style.icon}
                        </span>
                      )}
                      {style.label && (
                        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.03em] leading-none">
                          {style.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Detalle del día */}
          {selectedDay && detail && selectedStatus && (
            <div
              className="mt-2.5 rounded-[14px] border border-[#E8EAF0] bg-white px-5 py-4 transition-all duration-200"
              style={{
                opacity: 1,
                transform: 'translateY(0)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold capitalize text-[#1A1D23]">
                  {format(parseISO(selectedDay), "d 'de' MMMM", { locale: es })}
                </p>
                <span
                  className="rounded-[20px] px-3 py-0.5 text-xs font-medium"
                  style={{
                    background: DAY_STYLES[selectedStatus].bg,
                    color: DAY_STYLES[selectedStatus].text,
                    border: `1px solid ${DAY_STYLES[selectedStatus].border}`,
                  }}
                >
                  {detail.badge}
                </span>
              </div>
              <div className="mt-3 rounded-[12px] border border-[#E8EAF0] bg-[#F8FAFC] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#475569]">Clase</p>
                <p className="mt-1.5 text-[13px] leading-[1.65] text-[#6B7280]">{detail.description}</p>
                {selectedClassLines.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-[#E8EAF0] pt-2">
                    {selectedClassLines.map((line, index) => (
                      <p key={`${selectedDay}-clase-${index}`} className="text-[13px] leading-[1.65] text-[#475569]">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {selectedClassIncidentLines.length > 0 && (
                <div className="mt-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#92400E]">
                    Incidencias
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {selectedClassIncidentLines.map((line, index) => (
                      <p
                        key={`${selectedDay}-inc-${index}`}
                        className="text-[13px] leading-[1.65] text-[#78350F]"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {(selectedTallerLines.length > 0 || selectedTallerIncidentLines.length > 0) && (
                <div className="mt-3 rounded-[12px] border border-[#DBEAFE] bg-[#F8FBFF] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DBEAFE] px-1.5 text-[10px] font-semibold text-[#1D4ED8]">
                      T
                    </span>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#1D4ED8]">
                      Talleres
                    </p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {selectedTallerLines.map((line, index) => (
                      <p key={`${selectedDay}-taller-${index}`} className="text-[13px] leading-[1.65] text-[#475569]">
                        {line}
                      </p>
                    ))}
                    {selectedTallerIncidentLines.map((line, index) => (
                      <p
                        key={`${selectedDay}-taller-inc-${index}`}
                        className="text-[13px] leading-[1.65] text-[#475569]"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {(
              [
                ['present', 'A tiempo'],
                ['late', 'Tardanza'],
                ...(hideAbsent ? [] : ([['absent', 'Falta']] as const)),
                ['noclass', 'Sin clase'],
                ['norecord', 'Sin registro'],
              ] as const
            ).map(([key, label]) => {
              const s = DAY_STYLES[key];
              return (
                <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-[3px] border"
                    style={{ background: s.bg, borderColor: s.border }}
                    aria-hidden
                  />
                  {label}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[9px] font-semibold"
                style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }}
                aria-hidden
              >
                i
              </span>
              Incidencia
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
