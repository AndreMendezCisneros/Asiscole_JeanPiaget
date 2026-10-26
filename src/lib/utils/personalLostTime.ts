import type { Personal, PersonalArrivalRecord } from '@/types/personal';
import { DEFAULT_ABSENCE_AFTER_MIN, minutesOf, scheduleForDate } from './personalSchedule';
import { dateKeysBetween, resolveDayStatus } from './personalAttendanceRows';

/** Motivo por el que se pierde tiempo de trabajo en un día. */
export type LostTimeKind = 'tardanza' | 'inasistencia' | 'salida anticipada';

export interface LostTimeItem {
  date: string;
  kind: LostTimeKind;
  /** Minutos no trabajados; null si no se puede calcular (día sin hora de salida). */
  minutes: number | null;
  justified: boolean;
  detail: string;
}

export interface LostTimeSummary {
  personal: Personal;
  /** Minutos programados (suma de jornadas con hora de salida definida). */
  scheduledMin: number;
  /** Minutos perdidos incluyendo los justificados. */
  lostTotalMin: number;
  /** Parte justificada (tarde justificada, inasistencia justificada, salida autorizada). */
  lostJustifiedMin: number;
  /** Perdidos sin justificar = total − justificados. */
  lostNetMin: number;
  lateMin: number;
  absenceMin: number;
  earlyMin: number;
  absenceDays: number;
  /** Días que no marcó salida (no se descuentan; RR.HH. los revisa). */
  noDepartureDays: number;
  /** Días con horario sin hora de salida (no se puede calcular la jornada). */
  daysWithoutExit: number;
  items: LostTimeItem[];
}

export type LostTimeView = 'total' | 'neto';

function diff(a: string, b: string): number {
  return Math.max(0, minutesOf(a) - minutesOf(b));
}

/**
 * Tiempo no trabajado por empleado en un rango:
 * tardanza = llegada − entrada; inasistencia = jornada completa (salida − entrada);
 * salida anticipada = hora de salida − hora en que salió.
 */
export function computeLostTime(
  personal: Personal[],
  records: PersonalArrivalRecord[],
  from: string,
  to: string,
  today: string,
  nowHHmm: string,
  absenceAfterMin = DEFAULT_ABSENCE_AFTER_MIN,
): LostTimeSummary[] {
  const byKey = new Map(records.map((r) => [`${r.personalId}|${r.date}`, r]));
  const lastDay = to < today ? to : today;
  const days = from <= lastDay ? dateKeysBetween(from, lastDay) : [];

  return personal.map((p) => {
    const s: LostTimeSummary = {
      personal: p,
      scheduledMin: 0,
      lostTotalMin: 0,
      lostJustifiedMin: 0,
      lostNetMin: 0,
      lateMin: 0,
      absenceMin: 0,
      earlyMin: 0,
      absenceDays: 0,
      noDepartureDays: 0,
      daysWithoutExit: 0,
      items: [],
    };
    const add = (item: LostTimeItem) => {
      s.items.push(item);
      if (item.minutes == null) return;
      s.lostTotalMin += item.minutes;
      if (item.justified) s.lostJustifiedMin += item.minutes;
      if (item.kind === 'tardanza') s.lateMin += item.minutes;
      else if (item.kind === 'inasistencia') s.absenceMin += item.minutes;
      else s.earlyMin += item.minutes;
    };

    for (const date of days) {
      if (date < p.createdAt) continue;
      const record = byKey.get(`${p.id}|${date}`) ?? null;
      const horario = scheduleForDate(p.schedule, date);
      const entry = record?.expectedEntry ?? horario?.entry ?? null;
      if (!entry) continue; // no le toca (o fuera de horario): no hay jornada que perder
      const exit = record?.departureTime ? record.expectedExit ?? horario?.exit ?? null : horario?.exit ?? record?.expectedExit ?? null;
      const jornada = exit ? diff(exit, entry) : null;
      if (jornada == null) s.daysWithoutExit++;
      else s.scheduledMin += jornada;

      const status = resolveDayStatus(horario ?? { day: 1, entry, exit }, record, date, today, nowHHmm, absenceAfterMin);

      if (status === 'Falta' || status === 'Falta justificada') {
        s.absenceDays++;
        add({
          date,
          kind: 'inasistencia',
          minutes: jornada,
          justified: status === 'Falta justificada',
          detail: record?.arrivalTime ? `Llegó ${record.arrivalTime}, después de su salida` : 'No asistió',
        });
        continue;
      }
      if ((status === 'Tarde' || status === 'Tarde justificada') && record?.arrivalTime) {
        const late = diff(record.arrivalTime, entry);
        add({
          date,
          kind: 'tardanza',
          minutes: jornada == null ? late : Math.min(late, jornada),
          justified: status === 'Tarde justificada',
          detail: `Entrada ${entry}, llegó ${record.arrivalTime}`,
        });
      }
      if (record?.arrivalTime) {
        if (record.departureTime) {
          if (exit && minutesOf(record.departureTime) < minutesOf(exit)) {
            add({
              date,
              kind: 'salida anticipada',
              minutes: diff(exit, record.departureTime),
              justified: record.departureType === 'Autorizada',
              detail: `Salida ${exit}, salió ${record.departureTime}${record.departureType === 'Autorizada' ? ' (autorizada)' : ''}`,
            });
          }
        } else if (date < today || (exit && minutesOf(nowHHmm) > minutesOf(exit))) {
          s.noDepartureDays++;
        }
      }
    }
    s.lostNetMin = s.lostTotalMin - s.lostJustifiedMin;
    s.items.sort((a, b) => b.date.localeCompare(a.date));
    return s;
  });
}

/** Minutos perdidos según la vista: total (incluye justificados) o neto (los descuenta). */
export function lostFor(s: Pick<LostTimeSummary, 'lostTotalMin' | 'lostNetMin'>, view: LostTimeView): number {
  return view === 'total' ? s.lostTotalMin : s.lostNetMin;
}

/** % de la jornada programada efectivamente cumplida según la vista. */
export function compliancePct(s: LostTimeSummary, view: LostTimeView): number | null {
  if (s.scheduledMin <= 0) return null;
  return Math.max(0, Math.round(((s.scheduledMin - lostFor(s, view)) / s.scheduledMin) * 100));
}

/** 510 → "8 h 30 min"; 45 → "45 min"; 0 → "0 min". */
export function formatMinutes(total: number | null): string {
  if (total == null) return '—';
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}
