import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { arrivalService } from '@/lib/services';
import type { ArrivalRecord, Student } from '@/types';
import type { ArrivalLimitsByLevel } from '@/lib/utils/arrivalLimit';
import { resolveArrivalLimitForLevel } from '@/lib/utils/arrivalLimit';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { getLimaMonthBounds, getLimaTodayDate } from '@/lib/utils/limaDateTime';
import {
  buildMonthGrid,
  computeMonthMetrics,
  DAY_STYLES,
  dayDetailCopy,
  firstName,
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

  const [viewYear, setViewYear] = useState(current.year);
  const [viewMonth, setViewMonth] = useState(current.month);
  const [monthArrivals, setMonthArrivals] = useState<ArrivalRecord[]>(initialMonthArrivals);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [arrivalLimits, setArrivalLimits] = useState<ArrivalLimitsByLevel>({
    general: '08:00',
    primaria: '08:00',
    secundaria: '08:00',
  });

  useEffect(() => {
    void arrivalService.fetchPublicArrivalLimits().then(setArrivalLimits);
  }, []);

  const calendarCtx = useMemo(
    () => ({ limits: arrivalLimits, level: student.level }),
    [arrivalLimits, student.level],
  );
  const studentArrivalLimit = useMemo(
    () => resolveArrivalLimitForLevel(arrivalLimits, student.level),
    [arrivalLimits, student.level],
  );

  const loadMonth = useCallback(
    async (year: number, month: number) => {
      setLoadingMonth(true);
      const data = await arrivalService.fetchMonthArrivalsForStudent(
        student.id,
        year,
        month,
        student.level,
      );
      setMonthArrivals(data);
      setLoadingMonth(false);
    },
    [student.id]
  );

  useEffect(() => {
    const isInitial =
      viewYear === current.year &&
      viewMonth === current.month &&
      initialMonthArrivals.length > 0;
    if (isInitial) {
      setMonthArrivals(initialMonthArrivals);
      return;
    }
    void loadMonth(viewYear, viewMonth);
  }, [viewYear, viewMonth, current.year, current.month, initialMonthArrivals, loadMonth]);

  const byDate = useMemo(() => {
    const map = new Map(monthArrivals.map((a) => [a.date, a]));
    if (todayArrival && todayArrival.date.startsWith(`${viewYear}-${String(viewMonth).padStart(2, '0')}`)) {
      map.set(todayArrival.date, todayArrival);
    }
    return map;
  }, [monthArrivals, todayArrival, viewYear, viewMonth]);

  const metrics = useMemo(
    () => computeMonthMetrics(viewYear, viewMonth, byDate, todayKey, calendarCtx),
    [viewYear, viewMonth, byDate, todayKey, calendarCtx]
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
    ? resolveDayStatus(selectedDay, byDate.get(selectedDay), todayKey, calendarCtx)
    : null;
  const selectedRecord = selectedDay ? byDate.get(selectedDay) : undefined;
  const detail =
    selectedDay && selectedStatus
      ? dayDetailCopy(
          selectedStatus,
          studentFirst,
          selectedRecord ? parseArrivalTime12h(selectedRecord.arrivalTime) : undefined
        )
      : null;

  const metricCards = [
    { key: 'present' as const, label: 'Días presentes', value: metrics.present },
    { key: 'late' as const, label: 'Tardanzas', value: metrics.late },
    { key: 'absent' as const, label: 'Faltas', value: metrics.absent },
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
          <p className="mt-2 text-[11px] font-medium text-[#9095A3]">
            Hora límite de llegada ({student.level || 'nivel'}):{' '}
            <span className="font-mono text-[#1A1D23]">{studentArrivalLimit}</span>
          </p>
        </div>

        <div className="my-5 h-px w-full bg-[#E8EAF0]" />

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2.5">
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

                  const status = resolveDayStatus(dayKey, byDate.get(dayKey), todayKey, calendarCtx);
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
                        'flex min-h-[44px] flex-col items-center justify-center rounded-[10px] border px-0.5 py-1 sm:min-h-[52px]',
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
              <p className="mt-2 text-[13px] leading-[1.65] text-[#6B7280]">{detail.description}</p>
            </div>
          )}

          {/* Leyenda */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {(
              [
                ['present', 'A tiempo'],
                ['late', 'Tardanza'],
                ['absent', 'Falta'],
                ['noclass', 'Sin clase'],
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
          </div>
        </div>
      </div>
    </article>
  );
}
