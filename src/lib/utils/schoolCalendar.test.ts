import { describe, expect, it } from 'vitest';
import {
  addDays,
  businessDayWindowsForMonth,
  businessDaysBetween,
  formatDayLabel,
  isSchoolDay,
  previousMonth,
  weekdayOf,
} from './schoolCalendar';

describe('schoolCalendar', () => {
  it('calcula el día de la semana sin depender de la zona del navegador', () => {
    expect(weekdayOf('2026-09-28')).toBe(1);
    expect(weekdayOf('2026-10-04')).toBe(0);
  });

  it('suma días cruzando fin de mes', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('omite sábado, domingo y feriados', () => {
    expect(isSchoolDay('2026-10-03')).toBe(false);
    expect(isSchoolDay('2026-10-08', new Set(['2026-10-08']))).toBe(false);
    expect(businessDaysBetween('2026-09-25', '2026-09-30')).toEqual([
      '2026-09-25',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
  });

  it('corta el mes en curso en hoy', () => {
    const days = businessDayWindowsForMonth(2026, 10, new Set(), '2026-10-01');
    expect(days.map((d) => d.key)).toEqual(['2026-10-01']);
    expect(days[0].desde).toBe('2026-10-01T00:00:00.000-05:00');
  });

  it('etiqueta y mes anterior', () => {
    expect(formatDayLabel('2026-09-28')).toBe('Lun 28');
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});
