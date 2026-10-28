import {
  canonicalGrade,
  canonicalLevel,
  canonicalSection,
  classroomKey,
  type ClassroomEnrollment,
  type LatenessClassroom,
  type LatenessDay,
  type LatenessGradeRow,
} from './latenessStats';
import { ABSENCE_INFERENCE_START, ARRIVAL_ESTADO, isWeekdayDateKey } from './attendanceJustification';

/** Estudiante activo (con su aula) considerado en el reporte de faltas. */
export interface AbsenceStudentInput {
  id: number;
  name: string;
  level: string;
  grade: string;
  section: string;
}

/** Llegada registrada (cualquier estado). */
export interface AbsenceArrivalInput {
  studentId: number;
  date: string;
  estado: string;
}

export interface AbsenceStudent {
  studentId: number;
  studentName: string;
  classroomKey: string;
  classroomLabel: string;
  /** Faltas sin justificar + justificadas. */
  absences: number;
  justified: number;
  /** Días con clases del período. */
  schoolDays: number;
  /** Días asistidos / días con clases (0-1). */
  attendanceRate: number;
  lastAbsence: string | null;
  /** Fechas de las faltas (para el detalle). */
  dates: string[];
}

export interface AbsenceSummary {
  /** Días hábiles ya cerrados en los que se tomó asistencia. */
  schoolDays: string[];
  totalAbsences: number;
  justified: number;
  studentsWithAbsences: number;
  /** Asistencia global: días asistidos / (estudiantes × días con clases). */
  attendanceRate: number | null;
  sections: string[];
  /** Mismo formato que tardanzas (lateCount = faltas) para reutilizar mapa y ranking. */
  grades: LatenessGradeRow[];
  classrooms: LatenessClassroom[];
  maxClassroomAbsences: number;
  students: AbsenceStudent[];
  days: LatenessDay[];
}

const LEVEL_SHORT: Record<string, string> = { inicial: 'Inic.', primaria: 'Prim.', secundaria: 'Sec.' };
const LEVEL_ORDER = ['inicial', 'primaria', 'secundaria'];

/**
 * Días con clases: hábiles, anteriores a hoy, desde el inicio del cálculo de faltas
 * y con al menos una llegada registrada (si nadie registró llegada, no se tomó asistencia).
 */
export function schoolDaysFrom(arrivals: AbsenceArrivalInput[], dateFrom: string, dateTo: string, todayKey: string): string[] {
  const from = dateFrom > ABSENCE_INFERENCE_START ? dateFrom : ABSENCE_INFERENCE_START;
  const days = new Set<string>();
  for (const a of arrivals) {
    const d = a.date.slice(0, 10);
    if (d >= from && d <= dateTo && d < todayKey && isWeekdayDateKey(d)) days.add(d);
  }
  return [...days].sort();
}

/** Faltas por estudiante, aula y día. */
export function buildAbsenceSummary(
  students: AbsenceStudentInput[],
  arrivals: AbsenceArrivalInput[],
  schoolDays: string[],
  enrollment?: ClassroomEnrollment[],
): AbsenceSummary {
  const daySet = new Set(schoolDays);
  const byStudent = new Map<number, Map<string, string>>();
  for (const a of arrivals) {
    const d = a.date.slice(0, 10);
    if (!daySet.has(d)) continue;
    const m = byStudent.get(a.studentId) ?? new Map<string, string>();
    m.set(d, a.estado);
    byStudent.set(a.studentId, m);
  }

  const levels = new Set(students.map((s) => canonicalLevel(s.level)));
  const multiLevel = levels.size > 1;
  const labelFor = (level: string, grade: string, section: string) =>
    `${multiLevel ? `${LEVEL_SHORT[level.toLowerCase()] ?? level} ` : ''}${grade} ${section}`.trim();

  const perDay = new Map<string, number>();
  const rooms = new Map<string, { level: string; grade: string; section: string; absences: number; students: Set<number>; enrolled: number }>();
  const result: AbsenceStudent[] = [];
  let attended = 0;
  let totalAbsences = 0;
  let justified = 0;

  for (const s of students) {
    const level = canonicalLevel(s.level);
    const grade = canonicalGrade(s.grade);
    const section = canonicalSection(s.section);
    const key = classroomKey(level, grade, section);
    const room = rooms.get(key) ?? { level, grade, section, absences: 0, students: new Set<number>(), enrolled: 0 };
    room.enrolled += 1;
    rooms.set(key, room);

    const records = byStudent.get(s.id) ?? new Map<string, string>();
    const dates: string[] = [];
    let just = 0;
    for (const d of schoolDays) {
      const estado = records.get(d);
      const isJustified = estado === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED;
      const isAbsent = !estado || isJustified || estado === 'Falta' || estado === 'Injustificada';
      if (isAbsent) {
        dates.push(d);
        if (isJustified) just += 1;
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
      } else {
        attended += 1;
      }
    }
    if (dates.length > 0) {
      room.absences += dates.length;
      room.students.add(s.id);
    }
    totalAbsences += dates.length;
    justified += just;
    result.push({
      studentId: s.id,
      studentName: s.name,
      classroomKey: key,
      classroomLabel: labelFor(level, grade, section),
      absences: dates.length,
      justified: just,
      schoolDays: schoolDays.length,
      attendanceRate: schoolDays.length > 0 ? (schoolDays.length - dates.length) / schoolDays.length : 1,
      lastAbsence: dates.length > 0 ? dates[dates.length - 1] : null,
      dates,
    });
  }

  // Aulas con alumnos activos pero fuera del filtro de la consulta (si se pasan)
  for (const e of enrollment ?? []) {
    const key = classroomKey(canonicalLevel(e.level), canonicalGrade(e.grade), canonicalSection(e.section));
    if (!rooms.has(key)) {
      rooms.set(key, { level: canonicalLevel(e.level), grade: canonicalGrade(e.grade), section: canonicalSection(e.section), absences: 0, students: new Set(), enrolled: e.students });
    }
  }

  const levelRank = (l: string) => {
    const i = LEVEL_ORDER.indexOf(l.toLowerCase());
    return i === -1 ? 9 : i;
  };
  const classrooms: LatenessClassroom[] = [...rooms.entries()]
    .map(([key, r]) => ({
      key,
      level: r.level,
      grade: r.grade,
      section: r.section,
      label: labelFor(r.level, r.grade, r.section),
      lateCount: r.absences,
      studentsLate: r.students.size,
      enrolled: r.enrolled,
      studentRate: r.enrolled > 0 ? r.students.size / r.enrolled : null,
    }))
    .sort(
      (a, b) =>
        levelRank(a.level) - levelRank(b.level) ||
        (parseInt(a.grade, 10) || 99) - (parseInt(b.grade, 10) || 99) ||
        a.grade.localeCompare(b.grade) ||
        a.section.localeCompare(b.section),
    );

  const gradeMap = new Map<string, LatenessGradeRow>();
  for (const c of classrooms) {
    const key = `${c.level}|${c.grade}`;
    const row =
      gradeMap.get(key) ??
      { key, level: c.level, grade: c.grade, label: multiLevel ? `${LEVEL_SHORT[c.level.toLowerCase()] ?? c.level} ${c.grade}` : c.grade, lateCount: 0, cells: {} };
    row.lateCount += c.lateCount;
    row.cells[c.section] = c;
    gradeMap.set(key, row);
  }

  result.sort((a, b) => b.absences - a.absences || a.studentName.localeCompare(b.studentName));
  const possible = students.length * schoolDays.length;

  return {
    schoolDays,
    totalAbsences,
    justified,
    studentsWithAbsences: result.filter((r) => r.absences > 0).length,
    attendanceRate: possible > 0 ? attended / possible : null,
    sections: [...new Set(classrooms.map((c) => c.section))].sort(),
    grades: [...gradeMap.values()],
    classrooms,
    maxClassroomAbsences: Math.max(0, ...classrooms.map((c) => c.lateCount)),
    students: result,
    days: schoolDays.map((date) => ({ date, lateCount: perDay.get(date) ?? 0 })),
  };
}
