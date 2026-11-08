import type { Personal, PersonalArrivalRecord, PersonalTallerRecord } from '@/types/personal';
import { minutesOf, scheduleForDate } from './personalSchedule';

export interface WorkedTimeSummary {
  /** Minutos reales trabajados (jornada + taller, sin contar dos veces lo que se cruza). */
  workedMin: number;
  /** Minutos de la jornada (salida − llegada). */
  classMin: number;
  /** Minutos de taller fuera de la jornada marcada ese día. */
  tallerMin: number;
  /** Días con al menos un tramo completo (entrada y salida). */
  daysWorked: number;
  /** Días pasados con entrada pero sin salida (cuentan 0). */
  noDepartureDays: number;
}

type Interval = [number, number];

function mergedLength(intervals: Interval[]): number {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: Interval | null = null;
  for (const [a, b] of sorted) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else if (b > cur[1]) {
      cur[1] = b;
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

/**
 * Horas trabajadas reales de un empleado: por cada día, hora en que salió − hora en que llegó
 * (jornada y talleres). Sin salida marcada el tramo cuenta 0 y el día se reporta aparte.
 */
export function computeWorkedTime(
  personalId: number,
  records: PersonalArrivalRecord[],
  talleres: PersonalTallerRecord[],
  today: string,
): WorkedTimeSummary {
  const byDate = new Map<string, { classIv: Interval | null; taller: Interval[] }>();
  const missing = new Set<string>();
  const dayOf = (date: string) => {
    let d = byDate.get(date);
    if (!d) {
      d = { classIv: null, taller: [] };
      byDate.set(date, d);
    }
    return d;
  };

  for (const r of records) {
    if (r.personalId !== personalId || !r.arrivalTime) continue;
    if (!r.departureTime) {
      if (r.date < today) missing.add(r.date);
      continue;
    }
    dayOf(r.date).classIv = [minutesOf(r.arrivalTime), minutesOf(r.departureTime)];
  }
  for (const t of talleres) {
    if (t.personalId !== personalId) continue;
    if (!t.departureTime) {
      if (t.date < today) missing.add(t.date);
      continue;
    }
    dayOf(t.date).taller.push([minutesOf(t.arrivalTime), minutesOf(t.departureTime)]);
  }

  const s: WorkedTimeSummary = { workedMin: 0, classMin: 0, tallerMin: 0, daysWorked: 0, noDepartureDays: 0 };
  for (const d of byDate.values()) {
    const all = d.classIv ? [d.classIv, ...d.taller] : d.taller;
    const worked = mergedLength(all);
    const cls = d.classIv ? mergedLength([d.classIv]) : 0;
    if (worked <= 0) continue;
    s.daysWorked++;
    s.workedMin += worked;
    s.classMin += cls;
    s.tallerMin += worked - cls;
  }
  s.noDepartureDays = missing.size;
  return s;
}

export interface UnauthorizedDeparture {
  date: string;
  expectedExit: string | null;
  departureTime: string;
  /** Minutos antes de su hora de salida; null si su horario no tiene salida. */
  minutesEarly: number | null;
  reason: string | null;
}

/** Salidas anticipadas sin autorización (las autorizadas no entran). */
export function unauthorizedDepartures(personal: Personal, records: PersonalArrivalRecord[]): UnauthorizedDeparture[] {
  return records
    .filter((r) => r.personalId === personal.id && r.departureType === 'Anticipada' && r.departureTime)
    .map((r) => {
      const exit = r.expectedExit ?? scheduleForDate(personal.schedule, r.date)?.exit ?? null;
      const departure = r.departureTime as string;
      return {
        date: r.date,
        expectedExit: exit,
        departureTime: departure,
        minutesEarly: exit ? Math.max(0, minutesOf(exit) - minutesOf(departure)) : null,
        reason: r.departureReason,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** "2026-11" → "Noviembre 2026". */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
}

/** Último día del mes "YYYY-MM" como "YYYY-MM-DD". */
export function monthEndOf(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey}-${String(last).padStart(2, '0')}`;
}

/** Meses "YYYY-MM" que toca el rango [from, to], en orden. */
export function monthsBetween(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > end) break;
    out.push(key);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Recorta el mes al rango [from, to]. */
export function monthRangeWithin(monthKey: string, from: string, to: string): { from: string; to: string } {
  const start = `${monthKey}-01`;
  const end = monthEndOf(monthKey);
  return { from: start < from ? from : start, to: end > to ? to : end };
}
