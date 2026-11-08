import type { IntegralStudentBlock } from '@/lib/services/integralReportService';
import { emptyAttendanceTotals, tallyAttendanceStatus } from './attendanceJustification';
import type { AttendanceStatus } from '@/types';
import { monthLabel, monthsBetween } from './personalWorkedTime';

export interface IntegralMonthRow {
  month: string;
  label: string;
  asistencias: number;
  tardanzas: number;
  faltas: number;
  asistenciasTarde: number;
  incidencias: number;
}

/** Resumen mes por mes de un estudiante (mismas reglas que `block.summary`). */
export function integralMonthlyBreakdown(block: IntegralStudentBlock, start: string, end: string): IntegralMonthRow[] {
  return monthsBetween(start, end).map((month) => {
    const manana = emptyAttendanceTotals();
    for (const r of block.manana.records) {
      if (r.date.startsWith(month)) tallyAttendanceStatus(manana, r.status as AttendanceStatus);
    }
    const tarde = emptyAttendanceTotals();
    for (const r of block.tarde.records) {
      if (r.date.startsWith(month)) tallyAttendanceStatus(tarde, r.status as AttendanceStatus);
    }
    return {
      month,
      label: monthLabel(month),
      asistencias: manana.onTime + manana.late + manana.lateJustified,
      tardanzas: manana.late,
      faltas: manana.absentJustified + manana.unjustified,
      asistenciasTarde: tarde.onTime,
      incidencias: block.incidents.filter((i) => i.registeredAt.slice(0, 7) === month).length,
    };
  });
}
