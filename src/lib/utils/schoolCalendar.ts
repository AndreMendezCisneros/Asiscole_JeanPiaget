/**
 * Calendario escolar (zona Lima): días hábiles = lunes a viernes que no estén
 * en `calendario_no_lectivo` activo. Única fuente para gráficos diarios.
 */
import { getLimaTodayDate, getMonthBounds } from '@/lib/utils/limaDateTime';

export type DayWindow = { key: string; label: string; desde: string; hasta: string };

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Día de la semana (0 = domingo) de una fecha calendario, sin depender de la zona del navegador. */
export function weekdayOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(key: string, days: number): string {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isWeekend(key: string): boolean {
  const dow = weekdayOf(key);
  return dow === 0 || dow === 6;
}

export function isSchoolDay(key: string, holidays: ReadonlySet<string> = new Set()): boolean {
  return !isWeekend(key) && !holidays.has(key.slice(0, 10));
}

/** Días hábiles entre `from` y `to` (ambos incluidos, YYYY-MM-DD). */
export function businessDaysBetween(
  from: string,
  to: string,
  holidays: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  if (from > to) return out;
  for (let key = from.slice(0, 10); key <= to.slice(0, 10); key = addDays(key, 1)) {
    if (isSchoolDay(key, holidays)) out.push(key);
  }
  return out;
}

/** Etiqueta corta para eje: "Lun 30". */
export function formatDayLabel(key: string): string {
  return `${WEEKDAY_SHORT[weekdayOf(key)]} ${parseKey(key).d}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

/** Ventana de un día en Lima (-05:00) para filtrar timestamps. */
export function dayWindow(key: string): DayWindow {
  return {
    key,
    label: formatDayLabel(key),
    desde: `${key}T00:00:00.000-05:00`,
    hasta: `${key}T23:59:59.999-05:00`,
  };
}

/**
 * Días hábiles de un mes; si es el mes en curso, corta en hoy (Lima).
 * `today` es inyectable para tests.
 */
export function businessDayWindowsForMonth(
  year: number,
  month: number,
  holidays: ReadonlySet<string> = new Set(),
  today: string = getLimaTodayDate(),
): DayWindow[] {
  const { start, end } = getMonthBounds(year, month);
  const last = end < today ? end : today;
  return businessDaysBetween(start, last, holidays).map(dayWindow);
}

/** Rango ISO (Lima) de un mes completo. */
export function monthRangeISO(year: number, month: number): { startDate: string; endDate: string } {
  const { start, end } = getMonthBounds(year, month);
  return {
    startDate: `${start}T00:00:00.000-05:00`,
    endDate: `${end}T23:59:59.999-05:00`,
  };
}

/** Mes anterior a (year, month). */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}