import type { MonthlyAttendanceDay } from '@/types';
import type { TutorAttendanceArrival, TutorAttendanceStudent } from '@/types/tutorAula';
import {
  arrivalDateKey,
  emptyAttendanceTotals,
  isCountableArrivalStatus,
  resolveReportStatusForDay,
  studentRecordId,
  tallyAttendanceStatus,
  type AttendanceTotals,
} from './attendanceJustification';

export interface TutorAttendanceDay extends MonthlyAttendanceDay {
  date: string;
}

export interface TutorAttendanceRow {
  student: TutorAttendanceStudent;
  days: TutorAttendanceDay[];
  totals: AttendanceTotals;
}

/** Fechas YYYY-MM-DD de `from` a `to`, inclusive (aritmética UTC: sin saltos por zona horaria). */
export function dateKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return out;
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Planilla del salón con las mismas reglas que el reporte del staff
 * (`resolveReportStatusForDay`): un día cerrado sin llegada cuenta como falto.
 */
export function buildTutorAttendanceRows(
  students: TutorAttendanceStudent[],
  arrivals: TutorAttendanceArrival[],
  dateKeys: string[],
  todayKey: string,
): TutorAttendanceRow[] {
  const byStudent = new Map<number, Map<string, TutorAttendanceArrival>>();
  for (const record of arrivals) {
    const studentId = studentRecordId(record.id_estudiante);
    const dateKey = arrivalDateKey(record.fecha);
    if (!studentId || !dateKey) continue;
    let byDay = byStudent.get(studentId);
    if (!byDay) {
      byDay = new Map();
      byStudent.set(studentId, byDay);
    }
    const prev = byDay.get(dateKey);
    // Si hay dos filas el mismo día, gana la que cuenta como asistencia.
    if (prev && isCountableArrivalStatus(prev.estado) && !isCountableArrivalStatus(record.estado)) continue;
    byDay.set(dateKey, record);
  }

  return students.map((student) => {
    const byDay = byStudent.get(studentRecordId(student.id)) ?? new Map<string, TutorAttendanceArrival>();
    const totals = emptyAttendanceTotals();
    const days = dateKeys.map((date) => {
      const record = byDay.get(date);
      const status = resolveReportStatusForDay(date, record?.estado, todayKey, {
        hasRecord: Boolean(record),
        arrivalTime: record?.hora_llegada,
      });
      tallyAttendanceStatus(totals, status);
      return {
        date,
        day: Number(date.slice(8, 10)),
        status,
        arrivalTime: record?.hora_llegada ?? undefined,
        departureTime: record?.hora_salida ?? undefined,
        justificationReason: record?.motivo_justificacion ?? undefined,
      };
    });
    return { student, days, totals };
  });
}
