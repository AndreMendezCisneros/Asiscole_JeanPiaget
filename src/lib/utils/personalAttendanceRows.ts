import type { HorarioDia, Personal, PersonalArrivalRecord } from '@/types/personal';
import { DEFAULT_ABSENCE_AFTER_MIN, minutesOf, scheduleForDate } from './personalSchedule';

/** Situación de un empleado en un día, combinando su horario con el registro. */
export type PersonalDayStatus =
  | PersonalArrivalRecord['status']
  /** Le tocaba y su hora de entrada aún no llega. */
  | 'Pendiente'
  /** Ya pasó su hora de entrada pero sigue dentro del margen antes de inasistencia. */
  | 'Sin llegada'
  /** No le toca ese día y no marcó. */
  | 'No le toca';

/** Estado de la salida de un día con llegada. */
export type PersonalDepartureStatus = 'Normal' | 'Anticipada' | 'Autorizada' | 'No marcó salida' | 'Pendiente';

export interface PersonalDayRow {
  personal: Personal;
  horario: HorarioDia | null;
  record: PersonalArrivalRecord | null;
  status: PersonalDayStatus;
}

/**
 * Sin registro: antes de su entrada → Pendiente; pasada la entrada → Sin llegada;
 * pasados `absenceAfterMin` minutos (o un día anterior) → Falta (inasistencia).
 */
export function resolveDayStatus(
  horario: HorarioDia | null,
  record: PersonalArrivalRecord | null,
  date: string,
  today: string,
  nowHHmm: string,
  absenceAfterMin = DEFAULT_ABSENCE_AFTER_MIN,
): PersonalDayStatus {
  if (record) return record.status;
  if (!horario) return 'No le toca';
  if (date < today) return 'Falta';
  if (date > today) return 'Pendiente';
  const now = minutesOf(nowHHmm);
  const entry = minutesOf(horario.entry);
  if (now <= entry) return 'Pendiente';
  return now >= entry + absenceAfterMin ? 'Falta' : 'Sin llegada';
}

/**
 * Salida de un día con llegada real. Sin salida: "No marcó salida" si el día ya
 * pasó o ya pasó su hora de salida; si no, "Pendiente".
 */
export function resolveDepartureStatus(
  record: PersonalArrivalRecord,
  expectedExit: string | null,
  today: string,
  nowHHmm: string,
): PersonalDepartureStatus {
  if (record.departureTime) return record.departureType ?? 'Normal';
  if (record.date < today) return 'No marcó salida';
  if (record.date === today && expectedExit && minutesOf(nowHHmm) > minutesOf(expectedExit)) {
    return 'No marcó salida';
  }
  return 'Pendiente';
}

export function buildPersonalDayRows(
  personal: Personal[],
  records: PersonalArrivalRecord[],
  date: string,
  today: string,
  nowHHmm: string,
  absenceAfterMin = DEFAULT_ABSENCE_AFTER_MIN,
): PersonalDayRow[] {
  const byPersonal = new Map(records.filter((r) => r.date === date).map((r) => [r.personalId, r]));
  return personal.map((p) => {
    const horario = scheduleForDate(p.schedule, date);
    const record = byPersonal.get(p.id) ?? null;
    return {
      personal: p,
      horario,
      record,
      status: resolveDayStatus(horario, record, date, today, nowHHmm, absenceAfterMin),
    };
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

/** Texto visible de cada estado (en la BD "Falta" = inasistencia). */
export const PERSONAL_STATUS_LABEL: Record<PersonalDayStatus, string> = {
  'A tiempo': 'A tiempo',
  Tarde: 'Tarde',
  'Tarde justificada': 'Tarde justificada',
  Falta: 'Inasistencia',
  'Falta justificada': 'Inasistencia justificada',
  'Fuera de horario': 'Fuera de horario',
  Pendiente: 'Pendiente',
  'Sin llegada': 'Aún sin marcar',
  'No le toca': 'No le toca',
};

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
  'Sin llegada': 'warning',
  'No le toca': 'outline',
};

export const DEPARTURE_STATUS_LABEL: Record<PersonalDepartureStatus, string> = {
  Normal: 'Normal',
  Anticipada: 'Anticipada sin autorización',
  Autorizada: 'Anticipada autorizada',
  'No marcó salida': 'No marcó salida',
  Pendiente: 'Pendiente',
};

export const DEPARTURE_STATUS_BADGE: Record<
  PersonalDepartureStatus,
  'success' | 'warning' | 'destructive' | 'outline' | 'info'
> = {
  Normal: 'success',
  Anticipada: 'destructive',
  Autorizada: 'info',
  'No marcó salida': 'warning',
  Pendiente: 'outline',
};
