import type { AttendancePeriodo, MonthlyAttendanceRow, Student, TallerAsistencia } from '@/types';

export type AttendanceTurnoFilter = AttendancePeriodo | 'ambos';

export const TURNO_LABELS: Record<AttendanceTurnoFilter, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  ambos: 'Ambos',
};

export function periodoLabel(periodo?: AttendancePeriodo): string {
  if (periodo === 'tarde') return 'Tarde';
  return 'Mañana';
}

export function tagAttendancePeriodo(
  rows: MonthlyAttendanceRow[],
  periodo: AttendancePeriodo,
): MonthlyAttendanceRow[] {
  return rows.map((row) => ({ ...row, periodo }));
}

export function monthDateKeys(year: number, month: number, daysInMonth: number): string[] {
  const mm = String(month).padStart(2, '0');
  return Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return `${year}-${mm}-${String(day).padStart(2, '0')}`;
  });
}

export function rangeDateKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (current <= last) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return keys;
}

export function buildTardeAttendanceRows(
  students: Student[],
  records: TallerAsistencia[],
  dateKeys: string[],
): MonthlyAttendanceRow[] {
  const byStudent = new Map<number, Map<string, TallerAsistencia>>();
  for (const record of records) {
    if (!byStudent.has(record.studentId)) {
      byStudent.set(record.studentId, new Map());
    }
    byStudent.get(record.studentId)!.set(record.date, record);
  }

  return students.map((student) => {
    let onTime = 0;
    const days = dateKeys.map((dateKey) => {
      const record = byStudent.get(student.id)?.get(dateKey);
      const present = Boolean(record?.arrivalTime);
      if (present) onTime += 1;
      return {
        day: Number(dateKey.slice(8, 10)),
        status: present ? ('A_tiempo' as const) : ('Sin_registro' as const),
        arrivalTime: record?.arrivalTime ?? undefined,
        departureTime: record?.departureTime ?? undefined,
      };
    });

    return {
      student,
      days,
      totals: {
        onTime,
        late: 0,
        justified: 0,
        unjustified: 0,
      },
      periodo: 'tarde' as const,
    };
  });
}

export function mergeTurnoRows(
  morning: MonthlyAttendanceRow[],
  afternoon: MonthlyAttendanceRow[],
): MonthlyAttendanceRow[] {
  const afternoonById = new Map(afternoon.map((row) => [row.student.id, row]));
  const merged: MonthlyAttendanceRow[] = [];
  const seen = new Set<number>();

  for (const row of morning) {
    merged.push(row);
    const tarde = afternoonById.get(row.student.id);
    if (tarde) {
      merged.push(tarde);
      seen.add(row.student.id);
    }
  }

  for (const row of afternoon) {
    if (!seen.has(row.student.id)) {
      merged.push(row);
    }
  }

  return merged;
}
