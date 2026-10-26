import type {
  DiaSemana,
  HorarioDia,
  PersonalArrivalEstado,
  PersonalDepartureType,
} from '@/types/personal';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Día ISO (1 = lunes … 7 = domingo) de una fecha YYYY-MM-DD, sin depender de la zona del navegador. */
export function isoWeekdayOf(dateKey: string): DiaSemana {
  const [y, m, d] = dateKey.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (dow === 0 ? 7 : dow) as DiaSemana;
}

/** Horario que le toca ese día, o null si ese día no asiste. */
export function scheduleForDate(schedule: HorarioDia[], dateKey: string): HorarioDia | null {
  const day = isoWeekdayOf(dateKey);
  return schedule.find((h) => h.day === day) ?? null;
}

/** Minutos sin marcar después de su entrada para quedar como inasistencia (configurable). */
export const DEFAULT_ABSENCE_AFTER_MIN = 120;

export function minutesOf(hhmm: string): number {
  return toMinutes(hhmm);
}

/**
 * Estado de llegada según el horario del día:
 * ≤ entrada → A tiempo; después de su entrada → Tarde (aunque sean horas);
 * después de su hora de salida → Falta (inasistencia); sin horario → Fuera de horario.
 */
export function resolvePersonalArrivalStatus(
  arrivalTime: string,
  expectedEntry: string | null,
  expectedExit: string | null = null,
): PersonalArrivalEstado {
  if (!expectedEntry) return 'Fuera de horario';
  if (expectedExit && toMinutes(arrivalTime) > toMinutes(expectedExit)) return 'Falta';
  return toMinutes(arrivalTime) <= toMinutes(expectedEntry) ? 'A tiempo' : 'Tarde';
}

/**
 * Salida antes de su hora de salida → "Anticipada" (sin autorización) o
 * "Autorizada" si se registró con permiso. A su hora o después → "Normal".
 */
export function resolvePersonalDepartureType(
  departureTime: string,
  expectedExit: string | null,
  withPermission = false,
): PersonalDepartureType {
  if (!expectedExit || toMinutes(departureTime) >= toMinutes(expectedExit)) return 'Normal';
  return withPermission ? 'Autorizada' : 'Anticipada';
}

/** Texto corto del horario semanal, p. ej. "Lun–Vie 07:30" o "Mar 07:00 · Mié 08:00". */
export function formatScheduleSummary(schedule: HorarioDia[]): string {
  if (schedule.length === 0) return 'Sin horario';
  const sorted = [...schedule].sort((a, b) => a.day - b.day);
  const short = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const sameEntry = sorted.every((h) => h.entry === sorted[0].entry);
  const consecutive = sorted.every((h, i) => i === 0 || h.day === sorted[i - 1].day + 1);
  if (sameEntry && consecutive && sorted.length > 1) {
    return `${short[sorted[0].day]}–${short[sorted[sorted.length - 1].day]} ${sorted[0].entry}`;
  }
  return sorted.map((h) => `${short[h.day]} ${h.entry}`).join(' · ');
}

/** Valida un horario: horas HH:mm, salida posterior a la entrada, sin días repetidos. */
export function validateSchedule(schedule: HorarioDia[]): string | null {
  const seen = new Set<number>();
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const h of schedule) {
    if (seen.has(h.day)) return 'Hay un día repetido en el horario.';
    seen.add(h.day);
    if (!timeRe.test(h.entry)) return 'Hora de entrada inválida.';
    if (!h.exit) return 'Cada día marcado necesita su hora de salida.';
    if (!timeRe.test(h.exit)) return 'Hora de salida inválida.';
    if (toMinutes(h.exit) <= toMinutes(h.entry)) {
      return 'La hora de salida debe ser posterior a la de entrada.';
    }
  }
  return null;
}
