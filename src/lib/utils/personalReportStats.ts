import type { Personal, PersonalArrivalRecord } from '@/types/personal';
import type { PersonalIncident } from '@/lib/services/personalIncidentsService';
import { scheduleForDate } from './personalSchedule';
import { dateKeysBetween } from './personalAttendanceRows';

export interface PersonalAttendanceSummary {
  personal: Personal;
  /** Días que le tocaba asistir (desde que fue registrado, hasta hoy). */
  scheduledDays: number;
  onTime: number;
  late: number;
  lateJustified: number;
  absent: number;
  absentJustified: number;
  /** Le tocaba, ya pasó y no hay registro (antes del cierre automático). */
  noRecord: number;
  offSchedule: number;
  earlyDepartures: number;
  /** Llegadas a tiempo / días con llegada real en su horario (0–100). */
  punctuality: number | null;
}

export function summarizePersonalAttendance(
  personal: Personal[],
  records: PersonalArrivalRecord[],
  from: string,
  to: string,
  today: string,
): PersonalAttendanceSummary[] {
  const byKey = new Map(records.map((r) => [`${r.personalId}|${r.date}`, r]));
  const lastDay = to < today ? to : today;
  const days = from <= lastDay ? dateKeysBetween(from, lastDay) : [];

  return personal.map((p) => {
    const s: PersonalAttendanceSummary = {
      personal: p,
      scheduledDays: 0,
      onTime: 0,
      late: 0,
      lateJustified: 0,
      absent: 0,
      absentJustified: 0,
      noRecord: 0,
      offSchedule: 0,
      earlyDepartures: 0,
      punctuality: null,
    };
    for (const r of records) {
      if (r.personalId !== p.id) continue;
      if (r.status === 'A tiempo') s.onTime++;
      else if (r.status === 'Tarde') s.late++;
      else if (r.status === 'Tarde justificada') s.lateJustified++;
      else if (r.status === 'Falta') s.absent++;
      else if (r.status === 'Falta justificada') s.absentJustified++;
      else if (r.status === 'Fuera de horario') s.offSchedule++;
      if (r.departureType === 'Anticipada') s.earlyDepartures++;
    }
    for (const date of days) {
      if (date < p.createdAt || !scheduleForDate(p.schedule, date)) continue;
      s.scheduledDays++;
      if (date < today && !byKey.has(`${p.id}|${date}`)) s.noRecord++;
    }
    const arrivals = s.onTime + s.late + s.lateJustified;
    s.punctuality = arrivals > 0 ? Math.round((s.onTime / arrivals) * 100) : null;
    return s;
  });
}

export function totalsOf(rows: PersonalAttendanceSummary[]) {
  return rows.reduce(
    (acc, r) => ({
      scheduledDays: acc.scheduledDays + r.scheduledDays,
      onTime: acc.onTime + r.onTime,
      late: acc.late + r.late + r.lateJustified,
      absent: acc.absent + r.absent + r.noRecord,
      justified: acc.justified + r.lateJustified + r.absentJustified,
      earlyDepartures: acc.earlyDepartures + r.earlyDepartures,
    }),
    { scheduledDays: 0, onTime: 0, late: 0, absent: 0, justified: 0, earlyDepartures: 0 },
  );
}

/** Conteo por clave, ordenado de mayor a menor. */
export function countBy<T>(items: T[], key: (item: T) => string): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function incidentMonthKey(incident: PersonalIncident): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' })
    .format(new Date(incident.registeredAt))
    .slice(0, 7);
}

export function formatLimaDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
