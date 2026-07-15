import { format, parseISO } from 'date-fns';
import type { ArrivalRecord } from '@/types';
import type { ArrivalLimitsByLevel } from '@/lib/utils/arrivalLimit';
import { resolveArrivalStatusForStudent } from '@/lib/utils/arrivalLimit';

export type ParentCalendarContext = {
  limits?: ArrivalLimitsByLevel;
  level?: string | null;
};

export type DayStatus = 'present' | 'late' | 'absent' | 'norecord' | 'noclass';

export const DAY_STYLES: Record<
  DayStatus,
  { bg: string; text: string; border: string; icon: string; label: string }
> = {
  present: {
    bg: '#E8EEF7',
    text: '#1A305E',
    border: '#B8C5DB',
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
  absent: {
    bg: '#FCEEEF',
    text: '#B11E2A',
    border: '#E8B4B8',
    icon: '✗',
    label: 'falta',
  },
  norecord: {
    bg: '#F4F6FA',
    text: '#6B7280',
    border: '#D9E0EC',
    icon: '',
    label: '',
  },
  noclass: {
    bg: '#EEF1F6',
    text: '#9095A3',
    border: '#D9E0EC',
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

function arrivalKind(
  record: ArrivalRecord,
  ctx?: ParentCalendarContext
): 'present' | 'late' {
  if (ctx?.limits) {
    return resolveArrivalStatusForStudent(record.arrivalTime, ctx.limits, ctx.level) === 'A tiempo'
      ? 'present'
      : 'late';
  }
  return record.status === 'A tiempo' ? 'present' : 'late';
}

export function resolveDayStatus(
  dayKey: string,
  record: ArrivalRecord | undefined,
  todayKey: string,
  ctx?: ParentCalendarContext
): DayStatus {
  if (isWeekend(dayKey) || dayKey > todayKey) return 'noclass';
  if (record) {
    return arrivalKind(record, ctx);
  }
  if (dayKey === todayKey) return 'norecord';
  return 'absent';
}

export function parseArrivalTime12h(t: string): string {
  const raw = t?.slice(0, 5) || '';
  if (!raw) return '—:—';
  const [h, m] = raw.split(':').map(Number);
  const suffix = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
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
  ctx?: ParentCalendarContext
): { present: number; late: number; absent: number } {
  const lastDay = new Date(year, month, 0).getDate();
  let present = 0;
  let late = 0;
  let absent = 0;

  for (let d = 1; d <= lastDay; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = resolveDayStatus(key, byDate.get(key), todayKey, ctx);
    if (status === 'present') present++;
    else if (status === 'late') late++;
    else if (status === 'absent') absent++;
  }
  return { present, late, absent };
}

export function topStripGradient(present: number, late: number, absent: number): string {
  const total = present + late + absent;
  if (total === 0) return 'linear-gradient(to right, #D9E0EC, #D9E0EC)';
  const g = (present / total) * 100;
  const a = (late / total) * 100;
  return `linear-gradient(to right, #B8C5DB 0%, #B8C5DB ${g}%, #F5C97A ${g}%, #F5C97A ${g + a}%, #E8B4B8 ${g + a}%, #E8B4B8 100%)`;
}

export function dayDetailCopy(
  status: DayStatus,
  studentFirstName: string,
  time?: string
): { badge: string; description: string } {
  const hora = time || '—:—';
  switch (status) {
    case 'present':
      return {
        badge: 'A tiempo',
        description: `${studentFirstName} asistió con normalidad. Entrada registrada a las ${hora}.`,
      };
    case 'late':
      return {
        badge: 'Tardanza',
        description: `${studentFirstName} llegó tarde. Entrada registrada a las ${hora}. Se recomienda reforzar la puntualidad.`,
      };
    case 'absent':
      return {
        badge: 'Falta',
        description: `${studentFirstName} no asistió al colegio este día. Si fue por enfermedad u otro motivo, puede justificarlo con la tutora.`,
      };
    case 'norecord':
      return {
        badge: 'Sin registro hoy',
        description:
          'Aún no hay entrada registrada hoy. Si su hijo/a ya llegó al colegio, puede demorar unos minutos en aparecer.',
      };
    default:
      return {
        badge: 'Sin clase',
        description: 'Este día no hubo clases (fin de semana, feriado o día futuro). No se registra asistencia.',
      };
  }
}

export { WEEKDAY_LABELS };
