import { describe, expect, it } from 'vitest';
import type { ArrivalRecord } from '@/types';
import { computeMonthMetrics, resolveDayStatus } from './parentAttendanceCalendar';
import type { ArrivalLimitsByLevel } from './arrivalLimit';

const limits: ArrivalLimitsByLevel = {
  general: '08:00',
  primaria: '08:00',
  secundaria: '19:20',
};

const ctx = { limits, level: 'Secundaria' as const };

const record = (date: string, status: ArrivalRecord['status']): ArrivalRecord => ({
  id: 1,
  studentId: 1,
  date,
  arrivalTime: '08:00',
  status,
  registeredBy: 1,
  createdAt: date,
});

describe('parentAttendanceCalendar', () => {
  it('marca falta en día hábil pasado sin registro', () => {
    expect(resolveDayStatus('2026-06-03', undefined, '2026-06-28')).toBe('absent');
  });

  it('hoy sin registro no es falta todavía', () => {
    expect(resolveDayStatus('2026-06-25', undefined, '2026-06-25')).toBe('norecord');
  });

  it('recalcula tarde según límite del nivel en el calendario', () => {
    const lateByLimit = record('2026-06-03', 'A tiempo');
    lateByLimit.arrivalTime = '19:34';
    expect(resolveDayStatus('2026-06-03', lateByLimit, '2026-06-28', ctx)).toBe('late');
    expect(resolveDayStatus('2026-06-03', record('2026-06-03', 'A tiempo'), '2026-06-28', ctx)).toBe(
      'present',
    );
  });

  it('cuenta faltas en días pasados sin escaneo', () => {
    const byDate = new Map<string, ArrivalRecord>([
      ['2026-06-02', record('2026-06-02', 'A tiempo')],
      ['2026-06-03', record('2026-06-03', 'Tarde')],
    ]);
    const metrics = computeMonthMetrics(2026, 6, byDate, '2026-06-05');
    expect(metrics.present).toBe(1);
    expect(metrics.late).toBe(1);
    // Lun 1 y Vie 5 sin registro = 2 faltas (sáb/dom no cuentan)
    expect(metrics.absent).toBe(2);
  });
});
