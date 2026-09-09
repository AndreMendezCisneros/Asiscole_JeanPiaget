import { describe, expect, it } from 'vitest';
import {
  convertArrivalEstadoToReport,
  emptyAttendanceTotals,
  isProtectedArrivalStatus,
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
});
