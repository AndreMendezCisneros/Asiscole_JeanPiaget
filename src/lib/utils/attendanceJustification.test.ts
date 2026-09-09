import { describe, expect, it } from 'vitest';
import {
  collapsePlaceholderArrivalStatus,
  convertArrivalEstadoToReport,
  emptyAttendanceTotals,
  isClosedFaltoEligibleDate,
  isWeekdayDateKey,
  isProtectedArrivalStatus,
  resolveReportStatusForDay,
  tallyAttendanceStatus,
} from './attendanceJustification';

describe('attendanceJustification', () => {
  it('no recalcula estados ya justificados', () => {
    expect(isProtectedArrivalStatus('Tarde justificada')).toBe(true);
    expect(isProtectedArrivalStatus('Falta justificada')).toBe(true);
    expect(isProtectedArrivalStatus('Falta')).toBe(true);
    expect(isProtectedArrivalStatus('Tarde')).toBe(false);
  });

  it('mapea TJ e IJ a la planilla', () => {
    expect(convertArrivalEstadoToReport('Tarde justificada')).toBe('Tarde_justificada');
    expect(convertArrivalEstadoToReport('Falta justificada')).toBe('Inasistencia_justificada');
    expect(convertArrivalEstadoToReport('Tarde')).toBe('Tarde');
    expect(convertArrivalEstadoToReport('Falta')).toBe('Injustificada');
  });

  it('cuenta totales TJ e IJ por separado', () => {
    const totals = emptyAttendanceTotals();
    tallyAttendanceStatus(totals, 'Tarde');
    tallyAttendanceStatus(totals, 'Tarde_justificada');
    tallyAttendanceStatus(totals, 'Inasistencia_justificada');
    expect(totals.late).toBe(1);
    expect(totals.lateJustified).toBe(1);
    expect(totals.absentJustified).toBe(1);
  });

  it('sábado y domingo no son días hábiles de clase', () => {
    expect(isWeekdayDateKey('2026-09-04')).toBe(true);
    expect(isWeekdayDateKey('2026-09-05')).toBe(false);
    expect(isWeekdayDateKey('2026-09-06')).toBe(false);
    expect(isWeekdayDateKey('2026-09-07')).toBe(true);
  });

  it('solo infiere falto en días hábiles cerrados desde el 07/09/2026', () => {
    expect(isClosedFaltoEligibleDate('2026-09-07', '2026-09-09')).toBe(true);
    expect(isClosedFaltoEligibleDate('2026-09-09', '2026-09-09')).toBe(false);
    expect(isClosedFaltoEligibleDate('2026-09-05', '2026-09-09')).toBe(false);
    expect(isClosedFaltoEligibleDate('2026-09-06', '2026-09-09')).toBe(false);
    expect(resolveReportStatusForDay('2026-09-07', null, '2026-09-09')).toBe('Injustificada');
    expect(resolveReportStatusForDay('2026-09-07', 'Falta', '2026-09-09')).toBe('Injustificada');
    expect(resolveReportStatusForDay('2026-09-09', null, '2026-09-09')).toBe('Sin_registro');
    expect(resolveReportStatusForDay('2026-06-03', null, '2026-09-09')).toBe('Sin_registro');
  });

  it('no infiere falto si ya hay llegada aunque el estado venga vacío', () => {
    expect(
      resolveReportStatusForDay('2026-09-07', null, '2026-09-09', {
        hasRecord: true,
        arrivalTime: '07:54',
      }),
    ).toBe('A_tiempo');
    expect(
      resolveReportStatusForDay('2026-09-07', 'A tiempo', '2026-09-09', { hasRecord: true }),
    ).toBe('A_tiempo');
    expect(
      resolveReportStatusForDay('2026-09-07', 'Falta', '2026-09-09', {
        hasRecord: true,
        arrivalTime: '07:54',
      }),
    ).toBe('A_tiempo');
  });

  it('Falta o A tiempo con 00:00 no cuenta como llegada', () => {
    expect(
      resolveReportStatusForDay('2026-09-07', 'Falta', '2026-09-09', {
        hasRecord: true,
        arrivalTime: '00:00:00',
      }),
    ).toBe('Injustificada');
    expect(collapsePlaceholderArrivalStatus('A tiempo', '00:00')).toBe('Falta');
    expect(collapsePlaceholderArrivalStatus('A tiempo', '07:40')).toBe('A tiempo');
  });
});
