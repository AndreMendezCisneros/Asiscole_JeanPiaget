import { format, parseISO } from 'date-fns';
import type { ArrivalRecord, Incident, TallerAsistencia } from '@/types';
import type { ArrivalLimitsByLevel } from '@/lib/utils/arrivalLimit';
import { resolveArrivalStatusForStudent } from '@/lib/utils/arrivalLimit';
import {
  hasUsableArrivalTime,
  isClosedFaltoEligibleDate,
  isRawAbsenceStatus,
} from '@/lib/utils/attendanceJustification';

export type CalendarLimitCtx = {
  limits: ArrivalLimitsByLevel;
  level?: string | null;
};

export type DayStatus =
  | 'present'
  | 'late'
  | 'late_justified'
  | 'absent'
  | 'absent_justified'
  | 'norecord'
  | 'noclass';

export const DAY_STYLES: Record<
  DayStatus,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  present: {
    bg: '#EAF4E0',
    text: '#2E6B1A',
    border: '#A8D88A',
    icon: '✓',
    label: 'tiempo',
  },
  late: {
    bg: '#FEF3DF',
    text: '#7A4A00',
    border: '#F5C97A',
    icon: '⏱',
    label: 'tarde',
  },
  late_justified: {
    bg: '#E8F1FE',
    text: '#1E40AF',
    border: '#93C5FD',
    icon: '⏱',
    label: 'TJ',
  },
  absent: {
    bg: '#FDEAEA',
    text: '#8B1F1F',
    border: '#F2A0A0',
    icon: '✗',
    label: 'falto',
  },
  absent_justified: {
    bg: '#F3E8FF',
    text: '#6B21A8',
    border: '#D8B4FE',
    icon: 'IJ',
    label: 'justif.',
  },
  norecord: {
    bg: '#F7F8FA',
    text: '#6B7280',
    border: '#E8EAF0',
    icon: '',
    label: '',
  },
  noclass: {
    bg: '#F1F2F5',
    text: '#9095A3',
    border: '#DDE0E8',
    icon: '',
    label: '',
  },
};

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const padStart = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const lastDay = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: padStart }, () => null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function isWeekend(dayKey: string): boolean {
  const dow = parseISO(dayKey).getDay();
  return dow === 0 || dow === 6;
}

function arrivalKind(record: ArrivalRecord, ctx?: CalendarLimitCtx): DayStatus {
  if (record.status === 'Falta justificada') return 'absent_justified';
  if (record.status === 'Tarde justificada') return 'late_justified';
  if (isRawAbsenceStatus(record.status)) return 'absent';
  const status = ctx
    ? resolveArrivalStatusForStudent(record.arrivalTime, ctx.limits, ctx.level)
    : record.status;
  return status === 'A tiempo' ? 'present' : 'late';
}

export function resolveDayStatus(
  dayKey: string,
  record: ArrivalRecord | undefined,
  todayKey: string,
  ctx?: CalendarLimitCtx,
): DayStatus {
  if (isWeekend(dayKey) || dayKey > todayKey) return 'noclass';
  if (record && hasUsableArrivalTime(record.arrivalTime)) {
    return arrivalKind(record, ctx);
  }
  if (record && (isRawAbsenceStatus(record.status) || record.status === 'Falta justificada')) {
    return record.status === 'Falta justificada' ? 'absent_justified' : 'absent';
  }
  if (isClosedFaltoEligibleDate(dayKey, todayKey)) return 'absent';
  return 'norecord';
}

export function parseArrivalTime12h(t: string): string {
  const raw = t?.slice(0, 5) || '';
  if (!raw) return '—:—';
  const [h, m] = raw.split(':').map(Number);
  const suffix = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function dayHasTaller(byDate: Map<string, TallerAsistencia[]>, dayKey: string): boolean {
  return (byDate.get(dayKey)?.length ?? 0) > 0;
}

export function formatTallerDayDetail(rows: TallerAsistencia[]): string[] {
  return rows.map((row) => {
    const arrival = parseArrivalTime12h(row.arrivalTime ?? '');
    if (row.departureTime) {
      const departure = parseArrivalTime12h(row.departureTime);
      return `Taller · llegó ${arrival} · salió ${departure}`;
    }
    return `Taller · llegó a las ${arrival} · salida pendiente`;
  });
}

export function formatTallerIncidentDayDetail(rows: Incident[]): string[] {
  return rows.map((row) => {
    const tallerNombre = row.tallerNombre?.trim();
    const faultName = row.faultType?.name?.trim() || 'Incidencia registrada';
    const tallerLabel = tallerNombre ? `Taller: ${tallerNombre}` : 'Taller';
    return `Incidencia (${tallerLabel}): ${faultName}`;
  });
}

/** Líneas de asistencia de clase: llegada y salida (si hay). */
export function formatClassAttendanceLines(record: ArrivalRecord | undefined): string[] {
  if (!record) return [];
  if (record.status === 'Falta justificada') {
    return ['Inasistencia justificada (IJ)'];
  }
  if (
    record.status === 'Falta' ||
    record.status === 'Injustificada' ||
    (record.status !== 'Tarde justificada' && !hasUsableArrivalTime(record.arrivalTime))
  ) {
    return ['Falto (inasistencia)'];
  }
  const statusLabel =
    record.status === 'Tarde justificada' ? 'Tarde justificada (TJ)' : record.status;
  const lines = [`Llegada: ${parseArrivalTime12h(record.arrivalTime)} (${statusLabel})`];
  if (record.departureTime) {
    const tipo = record.departureType ? ` · ${record.departureType}` : '';
    lines.push(`Salida: ${parseArrivalTime12h(record.departureTime)}${tipo}`);
  } else {
    lines.push('Salida: sin registrar');
  }
  return lines;
}

/** Incidencias de jornada regular (sin taller). */
export function formatClassIncidentDayDetail(rows: Incident[]): string[] {
  return rows.map((row) => {
    const faultName = row.faultType?.name?.trim() || 'Incidencia registrada';
    const hora = row.registeredAt?.slice(11, 16);
    const timePart = hora ? ` · ${parseArrivalTime12h(hora)}` : '';
    return `Incidencia: ${faultName}${timePart}`;
  });
}

export function dayHasIncident(byDate: Map<string, Incident[]>, dayKey: string): boolean {
  return (byDate.get(dayKey)?.length ?? 0) > 0;
}

export function firstName(fullName: string): string {
  const n = fullName.trim().split(/\s+/)[0];
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : 'El estudiante';
}

export function computeMonthMetrics(
  year: number,
  month: number,
  byDate: Map<string, ArrivalRecord>,
  todayKey: string,
  ctx?: CalendarLimitCtx,
): { present: number; late: number; absent: number } {
  const lastDay = new Date(year, month, 0).getDate();
  let present = 0;
  let late = 0;
  let absent = 0;

  for (let d = 1; d <= lastDay; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = resolveDayStatus(key, byDate.get(key), todayKey, ctx);
    if (status === 'present') present++;
    else if (status === 'late' || status === 'late_justified') late++;
    else if (status === 'absent' || status === 'absent_justified') absent++;
  }
  return { present, late, absent };
}

export function topStripGradient(present: number, late: number, absent: number): string {
  const total = present + late + absent;
  if (total === 0) return 'linear-gradient(to right, #DDE0E8, #DDE0E8)';
  const g = (present / total) * 100;
  const a = (late / total) * 100;
  return `linear-gradient(to right, #A8D88A 0%, #A8D88A ${g}%, #F5C97A ${g}%, #F5C97A ${g + a}%, #F2A0A0 ${g + a}%, #F2A0A0 100%)`;
}

export function dayDetailCopy(
  status: DayStatus,
  studentFirstName: string,
  time?: string,
  departureTime?: string | null,
): { badge: string; description: string } {
  const hora = time || '—:—';
  const salida =
    departureTime && departureTime.trim()
      ? ` Salida registrada a las ${parseArrivalTime12h(departureTime)}.`
      : '';
  switch (status) {
    case 'present':
      return {
        badge: 'A tiempo',
        description: `${studentFirstName} asistió con normalidad. Entrada registrada a las ${hora}.${salida}`,
      };
    case 'late':
      return {
        badge: 'Tardanza',
        description: `${studentFirstName} llegó tarde. Entrada registrada a las ${hora}.${salida} Se recomienda reforzar la puntualidad.`,
      };
    case 'late_justified':
      return {
        badge: 'Tardanza justificada',
        description: `${studentFirstName} llegó tarde, con justificación registrada. Entrada a las ${hora}.${salida}`,
      };
    case 'absent':
      return {
        badge: 'Falto',
        description: `${studentFirstName} no asistió al colegio este día (inasistencia). Si fue por enfermedad u otro motivo, puede justificarlo con la tutora.`,
      };
    case 'absent_justified':
      return {
        badge: 'Inasistencia justificada',
        description: `${studentFirstName} no asistió este día. La inasistencia está justificada ante el colegio.`,
      };
    case 'norecord':
      return {
        badge: 'Sin registro',
        description:
          'Aún no hay asistencia registrada este día. Cuando el colegio registre la entrada, aparecerá aquí.',
      };
    default:
      return {
        badge: 'Sin clase',
        description: 'Este día no hubo clases (fin de semana, feriado o día futuro). No se registra asistencia.',
      };
  }
}

export { WEEKDAY_LABELS };
