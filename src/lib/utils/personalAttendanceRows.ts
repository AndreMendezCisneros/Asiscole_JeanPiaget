import type { HorarioDia, Personal, PersonalArrivalRecord } from '@/types/personal';
import { scheduleForDate } from './personalSchedule';

/** Situación de un empleado en un día, combinando su horario con el registro. */
export type PersonalDayStatus =
  | PersonalArrivalRecord['status']
  /** Le tocaba y aún no marca (la hora de entrada todavía no pasó o es hoy). */
  | 'Pendiente'
  /** Le tocaba, la hora ya pasó y no marcó. */
  | 'Sin llegada'
  /** No le toca ese día y no marcó. */
  | 'No le toca';

export interface PersonalDayRow {
  personal: Personal;
  horario: HorarioDia | null;
  record: PersonalArrivalRecord | null;
  status: PersonalDayStatus;
}

export function resolveDayStatus(
  horario: HorarioDia | null,
  record: PersonalArrivalRecord | null,
  date: string,
  today: string,
  nowHHmm: string,
): PersonalDayStatus {
  if (record) return record.status;
  if (!horario) return 'No le toca';
  if (date < today) return 'Sin llegada';
  if (date > today) return 'Pendiente';
  return nowHHmm > horario.entry ? 'Sin llegada' : 'Pendiente';
}

export function buildPersonalDayRows(
  personal: Personal[],
  records: PersonalArrivalRecord[],
  date: string,
  today: string,
  nowHHmm: string,
): PersonalDayRow[] {
  const byPersonal = new Map(records.filter((r) => r.date === date).map((r) => [r.personalId, r]));
  return personal.map((p) => {
    const horario = scheduleForDate(p.schedule, date);
    const record = byPersonal.get(p.id) ?? null;
    return { personal: p, horario, record, status: resolveDayStatus(horario, record, date, today, nowHHmm) };
  });
}

/** Fechas YYYY-MM-DD entre `from` y `to` (inclusive), sin depender de la zona del navegador. */
export function dateKeysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cur = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cur <= end && keys.length < 400) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return keys;
}

/** Primer día del mes de una fecha YYYY-MM-DD. */
export function monthStartOf(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export const PERSONAL_STATUS_BADGE: Record<
  PersonalDayStatus,
  'success' | 'warning' | 'destructive' | 'secondary' | 'outline' | 'info'
> = {
  'A tiempo': 'success',
  Tarde: 'warning',
  'Tarde justificada': 'info',
  Falta: 'destructive',
  'Falta justificada': 'info',
  'Fuera de horario': 'secondary',
  Pendiente: 'outline',
  'Sin llegada': 'destructive',
  'No le toca': 'outline',
};
