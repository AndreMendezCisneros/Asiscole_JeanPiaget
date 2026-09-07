import { describe, expect, it } from 'vitest';
import type { ArrivalRecord, Incident } from '@/types';
import {
  computeMonthMetrics,
  formatClassAttendanceLines,
  formatClassIncidentDayDetail,
  resolveDayStatus,
} from './parentAttendanceCalendar';
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
  it('día hábil pasado sin registro queda en blanco', () => {
    expect(resolveDayStatus('2026-06-03', undefined, '2026-06-28')).toBe('norecord');
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

  it('no cuenta faltas en días pasados sin escaneo', () => {
    const byDate = new Map<string, ArrivalRecord>([
      ['2026-06-02', record('2026-06-02', 'A tiempo')],
      ['2026-06-03', record('2026-06-03', 'Tarde')],
    ]);
    const metrics = computeMonthMetrics(2026, 6, byDate, '2026-06-05');
    expect(metrics.present).toBe(1);
    expect(metrics.late).toBe(1);
    expect(metrics.absent).toBe(0);
  });

  it('muestra llegada y salida pendiente si no hay hora_salida', () => {
    expect(formatClassAttendanceLines(record('2026-09-07', 'Tarde'))).toEqual([
      'Llegada: 8:00 a.m. (Tarde)',
      'Salida: sin registrar',
    ]);
  });

  it('muestra hora de salida cuando está registrada', () => {
    const withExit = record('2026-09-07', 'Tarde');
    withExit.departureTime = '15:40';
    expect(formatClassAttendanceLines(withExit)).toEqual([
      'Llegada: 8:00 a.m. (Tarde)',
      'Salida: 3:40 p.m.',
    ]);
  });

  it('formatea incidencias del día con nombre y hora', () => {
    const incident = {
      id: 1,
      studentId: 1,
      faultTypeId: 11,
      faultType: {
        id: 11,
        name: 'Agresion Fisica',
        description: null,
        category: 'Conducta',
        severity: 'Grave',
        points: 0,
        active: true,
      },
      registeredBy: 1,
      registeredAt: '2026-09-07T07:55:00',
      observations: null,
      reincidenceLevel: 0,
      hasEvidence: false,
      evidenceCount: 0,
      status: 'Justificada',
    } as Incident;
    expect(formatClassIncidentDayDetail([incident])).toEqual([
      'Incidencia: Agresion Fisica · 7:55 a.m.',
    ]);
  });
});
