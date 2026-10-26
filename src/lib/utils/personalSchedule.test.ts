import { describe, expect, it } from 'vitest';
import {
  formatScheduleSummary,
  isoWeekdayOf,
  resolvePersonalArrivalStatus,
  resolvePersonalDepartureType,
  scheduleForDate,
  validateSchedule,
} from './personalSchedule';
import type { HorarioDia } from '@/types/personal';

const horario: HorarioDia[] = [
  { day: 2, entry: '07:00', exit: '13:00' },
  { day: 3, entry: '08:00', exit: '14:30' },
];

describe('personalSchedule', () => {
  it('calcula el día ISO sin depender de la zona horaria', () => {
    expect(isoWeekdayOf('2026-10-26')).toBe(1); // lunes
    expect(isoWeekdayOf('2026-10-27')).toBe(2);
    expect(isoWeekdayOf('2026-11-01')).toBe(7); // domingo
  });

  it('toma la hora de cada día', () => {
    expect(scheduleForDate(horario, '2026-10-27')?.entry).toBe('07:00');
    expect(scheduleForDate(horario, '2026-10-28')?.entry).toBe('08:00');
    expect(scheduleForDate(horario, '2026-10-26')).toBeNull();
  });

  it('marca tarde desde el minuto siguiente', () => {
    expect(resolvePersonalArrivalStatus('07:00', '07:00')).toBe('A tiempo');
    expect(resolvePersonalArrivalStatus('06:45', '07:00')).toBe('A tiempo');
    expect(resolvePersonalArrivalStatus('07:01', '07:00')).toBe('Tarde');
  });

  it('tarde aunque sean horas, inasistencia si llega después de su salida', () => {
    expect(resolvePersonalArrivalStatus('10:00', '07:00', '13:00')).toBe('Tarde');
    expect(resolvePersonalArrivalStatus('13:00', '07:00', '13:00')).toBe('Tarde');
    expect(resolvePersonalArrivalStatus('13:01', '07:00', '13:00')).toBe('Falta');
  });

  it('día sin horario queda fuera de horario', () => {
    expect(resolvePersonalArrivalStatus('09:00', null)).toBe('Fuera de horario');
  });

  it('detecta salida anticipada con o sin autorización', () => {
    expect(resolvePersonalDepartureType('12:59', '13:00')).toBe('Anticipada');
    expect(resolvePersonalDepartureType('12:59', '13:00', true)).toBe('Autorizada');
    expect(resolvePersonalDepartureType('13:00', '13:00', true)).toBe('Normal');
    expect(resolvePersonalDepartureType('12:00', null)).toBe('Normal');
  });

  it('resume el horario', () => {
    expect(formatScheduleSummary([])).toBe('Sin horario');
    expect(formatScheduleSummary(horario)).toBe('Mar 07:00 · Mié 08:00');
    const lv = [1, 2, 3, 4, 5].map((d) => ({ day: d as HorarioDia['day'], entry: '07:30', exit: null }));
    expect(formatScheduleSummary(lv)).toBe('Lun–Vie 07:30');
  });

  it('valida el horario', () => {
    expect(validateSchedule(horario)).toBeNull();
    expect(validateSchedule([{ day: 1, entry: '08:00', exit: '07:00' }])).toMatch(/posterior/);
    expect(validateSchedule([{ day: 1, entry: '8:00', exit: '13:00' }])).toMatch(/entrada/);
    expect(validateSchedule([{ day: 1, entry: '08:00', exit: null }])).toMatch(/salida/);
  });
});
