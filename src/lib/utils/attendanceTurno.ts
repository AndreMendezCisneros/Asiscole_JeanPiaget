import type { MonthlyAttendanceRow, Student } from '@/types';

type TallerAsistenciaLike = {
  studentId: number;
  date: string;
  arrivalTime: string | null;
  departureTime: string | null;
};

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
  records: TallerAsistenciaLike[],
  dateKeys: string[],
): MonthlyAttendanceRow[] {
  const byStudent = new Map<number, Map<string, TallerAsistenciaLike>>();
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
        lateJustified: 0,
        absentJustified: 0,
        justified: 0,
        unjustified: 0,
      },
    };
  });
}
