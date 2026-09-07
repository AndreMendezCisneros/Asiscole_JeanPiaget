import { describe, expect, it } from 'vitest';
import type { ArrivalRecord, Incident, TallerAsistencia } from '@/types';
import {
  computeMonthMetrics,
  dayHasIncident,
  dayHasTaller,
  dayDetailCopy,
  formatClassAttendanceLines,
  formatClassIncidentDayDetail,
  formatTallerIncidentDayDetail,
  formatTallerDayDetail,
  resolveDayStatus,
} from './parentAttendanceCalendar';

const record = (date: string, status: ArrivalRecord['status']): ArrivalRecord => ({
  id: 1,
  studentId: 1,
  date,
  arrivalTime: '08:00',
  status,
  registeredBy: 1,
  createdAt: date,
});

const tallerRecord = (overrides: Partial<TallerAsistencia> = {}): TallerAsistencia => ({
  id: 1,
  tallerId: 'taller-1',
  tallerNombre: 'Fútbol',
  studentId: 1,
  date: '2026-06-03',
  arrivalTime: '15:30',
  departureTime: '17:00',
  arrivalStatus: 'A tiempo',
  departureType: 'Normal',
  registeredBy: 1,
  ...overrides,
});

const incidentRecord = (overrides: Partial<Incident> = {}): Incident => ({
  id: 1,
  studentId: 1,
  faultTypeId: 10,
  registeredBy: 1,
  registeredAt: '2026-06-03T15:45:00-05:00',
  observations: null,
  reincidenceLevel: 0,
  hasEvidence: false,
  evidenceCount: 0,
  status: 'Activa',
  tallerId: 'taller-1',
  tallerNombre: 'Fútbol',
  faultType: {
    id: 10,
    name: 'Empujó a un compañero',
    description: null,
    recommendation: null,
    category: 'Conducta',
    severity: 'Leve',
    points: 1,
    active: true,
  },
  ...overrides,
});

describe('parentAttendanceCalendar', () => {
  it('marca feriado activo como sin clase y no como falta', () => {
    const holidays = new Map([['2026-10-08', 'Combate de Angamos']]);
    expect(resolveDayStatus('2026-10-08', undefined, '2026-10-10', holidays)).toBe('noclass');
    expect(dayDetailCopy('noclass', 'Ana', undefined, null, 'Combate de Angamos').badge).toBe(
      'Feriado',
    );
  });

  it('con VITE_ATTENDANCE_BLANK_IF_NO_RECORD no marca falta', () => {
    const prev = import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD;
    import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD = 'true';
    expect(resolveDayStatus('2026-06-03', undefined, '2026-06-28')).toBe('norecord');
    import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD = prev;
  });

  it('marca falta en día hábil pasado sin registro', () => {
    const prev = import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD;
    import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD = 'false';
    expect(resolveDayStatus('2026-06-03', undefined, '2026-06-28')).toBe('absent');
    import.meta.env.VITE_ATTENDANCE_BLANK_IF_NO_RECORD = prev;
  });

  it('hoy sin registro no es falta todavía', () => {
    expect(resolveDayStatus('2026-06-25', undefined, '2026-06-25')).toBe('norecord');
  });

  it('usa el estado guardado en el registro de llegada', () => {
    const lateRecord = record('2026-06-03', 'Tarde');
    lateRecord.arrivalTime = '19:34';
    expect(resolveDayStatus('2026-06-03', lateRecord, '2026-06-28')).toBe('late');
    expect(resolveDayStatus('2026-06-03', record('2026-06-03', 'A tiempo'), '2026-06-28')).toBe(
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

  it('detecta si un día tiene asistencia de taller', () => {
    const byDate = new Map<string, TallerAsistencia[]>([
      ['2026-06-03', [tallerRecord()]],
      ['2026-06-04', []],
    ]);

    expect(dayHasTaller(byDate, '2026-06-03')).toBe(true);
    expect(dayHasTaller(byDate, '2026-06-04')).toBe(false);
    expect(dayHasTaller(byDate, '2026-06-05')).toBe(false);
  });

  it('formatea líneas de detalle de talleres para el día seleccionado', () => {
    expect(
      formatTallerDayDetail([
        tallerRecord(),
        tallerRecord({
          id: 2,
          tallerId: 'taller-2',
          tallerNombre: 'Ajedrez',
          arrivalTime: null,
          departureTime: null,
        }),
      ])
    ).toEqual(['Taller · llegó 3:30 p.m. · salió 5:00 p.m.', 'Taller · llegó a las —:— · salida pendiente']);
  });

  it('formatea líneas de incidencias de taller para el día seleccionado', () => {
    expect(
      formatTallerIncidentDayDetail([
        incidentRecord(),
        incidentRecord({
          id: 2,
          tallerId: 'taller-2',
          tallerNombre: null,
          faultType: undefined,
        }),
      ])
    ).toEqual([
      'Incidencia (Taller: Fútbol): Empujó a un compañero',
      'Incidencia (Taller): Incidencia registrada',
    ]);
  });

  it('formatea llegada y salida de clase', () => {
    const withExit = record('2026-06-03', 'A tiempo');
    withExit.departureTime = '14:15';
    withExit.departureType = 'Normal';
    expect(formatClassAttendanceLines(withExit)).toEqual([
      'Llegada: 8:00 a.m. (A tiempo)',
      'Salida: 2:15 p.m. · Normal',
    ]);
    expect(formatClassAttendanceLines(record('2026-06-03', 'Tarde'))).toEqual([
      'Llegada: 8:00 a.m. (Tarde)',
      'Salida: sin registrar',
    ]);
    expect(formatClassAttendanceLines(undefined)).toEqual([]);
  });

  it('formatea incidencias de clase y detecta días con incidencia', () => {
    const classIncident = incidentRecord({
      tallerId: null,
      tallerNombre: null,
      registeredAt: '2026-06-03T10:20:00-05:00',
    });
    expect(formatClassIncidentDayDetail([classIncident])).toEqual([
      'Incidencia: Empujó a un compañero · 10:20 a.m.',
    ]);
    const byDate = new Map<string, Incident[]>([['2026-06-03', [classIncident]]]);
    expect(dayHasIncident(byDate, '2026-06-03')).toBe(true);
    expect(dayHasIncident(byDate, '2026-06-04')).toBe(false);
  });
});
