import { CLASSROOM_GRADES } from '@/lib/constants/classrooms';
import { normalizeTimeValue } from '@/config/systemSettings';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';

/** Una llegada tarde (estado «Tarde» o «Tarde justificada») con los datos del aula. */
export interface LatenessRow {
  recordId: number;
  studentId: number;
  studentName: string;
  photo: string | null;
  level: string;
  grade: string;
  section: string;
  date: string;
  time: string;
  justified: boolean;
  /** Minutos después de la hora límite del nivel; null si no se pudo calcular. */
  minutesLate: number | null;
}

/** Alumnos activos de un aula (para el % de alumnos con tardanza). */
export interface ClassroomEnrollment {
  level: string;
  grade: string;
  section: string;
  students: number;
}

export interface LatenessClassroom {
  key: string;
  level: string;
  grade: string;
  section: string;
  /** «1ro A» o «Prim. 1ro A» si hay más de un nivel. */
  label: string;
  lateCount: number;
  studentsLate: number;
  enrolled: number;
  /** Alumnos con al menos una tardanza / alumnos activos del aula (0-1). */
  studentRate: number | null;
}

export interface LatenessGradeRow {
  key: string;
  level: string;
  grade: string;
  label: string;
  lateCount: number;
  cells: Record<string, LatenessClassroom | undefined>;
}

export interface LatenessStudent {
  studentId: number;
  studentName: string;
  photo: string | null;
  classroomKey: string;
  classroomLabel: string;
  lateCount: number;
  justifiedCount: number;
  lastDate: string;
  lastTime: string;
  avgMinutesLate: number | null;
}

export interface LatenessDay {
  date: string;
  lateCount: number;
}

export interface LatenessSlice {
  key: string;
  label: string;
  value: number;
}

/** Tramos de minutos de retraso (en orden, para la escala secuencial). */
export const DELAY_BUCKETS = [
  { key: 'd1', label: '1 a 5 min', max: 5 },
  { key: 'd2', label: '6 a 15 min', max: 15 },
  { key: 'd3', label: '16 a 30 min', max: 30 },
  { key: 'd4', label: 'Más de 30 min', max: Infinity },
] as const;

export interface LatenessSummary {
  totalLate: number;
  studentsLate: number;
  justified: number;
  avgMinutesLate: number | null;
  /** Llegadas registradas en el período (a tiempo + tarde); null si no se pudo contar. */
  arrivalsTotal: number | null;
  /** Tardanzas / llegadas registradas (0-1). */
  lateRate: number | null;
  sections: string[];
  grades: LatenessGradeRow[];
  classrooms: LatenessClassroom[];
  students: LatenessStudent[];
  days: LatenessDay[];
  maxClassroomLate: number;
  /** Tardanzas por nivel educativo, en orden Inicial → Primaria → Secundaria. */
  byLevel: LatenessSlice[];
  /** Tardanzas por tramo de minutos (sin las que no tienen hora). */
  byDelay: LatenessSlice[];
}

const LEVEL_ORDER = ['inicial', 'primaria', 'secundaria'];

const LEVEL_SHORT: Record<string, string> = {
  inicial: 'Inic.',
  primaria: 'Prim.',
  secundaria: 'Sec.',
};

/** «4» y «4to» son el mismo grado (importaciones antiguas). */
export function canonicalGrade(grade: string | null | undefined): string {
  const g = (grade ?? '').trim();
  return CLASSROOM_GRADES.find((c) => gradeFilterValues(c).includes(g)) ?? g;
}

export function canonicalSection(section: string | null | undefined): string {
  return (section ?? '').trim().toUpperCase();
}

export function canonicalLevel(level: string | null | undefined): string {
  const l = (level ?? '').trim();
  if (!l) return 'Sin nivel';
  return l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
}

function levelRank(level: string): number {
  const i = LEVEL_ORDER.indexOf(level.toLowerCase());
  return i === -1 ? LEVEL_ORDER.length : i;
}

function gradeRank(grade: string): number {
  const n = parseInt(grade, 10);
  return Number.isNaN(n) ? 99 : n;
}

export function classroomKey(level: string, grade: string, section: string): string {
  return `${level}|${grade}|${section}`;
}

export function minutesBetween(time: string, limit: string): number | null {
  const toMin = (v: string) => {
    const [h, m] = normalizeTimeValue(v, '').split(':').map((x) => parseInt(x, 10));
    return Number.isNaN(h) ? null : h * 60 + (m || 0);
  };
  const a = toMin(time);
  const b = toMin(limit);
  if (a == null || b == null) return null;
  return Math.max(0, a - b);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Agrupa las llegadas tarde por aula (nivel + grado + sección), por grado y por alumno.
 * Las aulas sin tardanzas también aparecen si tienen alumnos activos, para que el mapa
 * muestre qué aulas están limpias.
 */
export function buildLatenessSummary(
  rows: LatenessRow[],
  enrollment: ClassroomEnrollment[],
  arrivalsTotal: number | null,
): LatenessSummary {
  const enrolledByKey = new Map<string, number>();
  for (const e of enrollment) {
    const key = classroomKey(canonicalLevel(e.level), canonicalGrade(e.grade), canonicalSection(e.section));
    enrolledByKey.set(key, (enrolledByKey.get(key) ?? 0) + e.students);
  }

  const lateByKey = new Map<string, { count: number; students: Set<number> }>();
  const byStudent = new Map<number, LatenessRow[]>();
  const byDay = new Map<string, number>();

  for (const row of rows) {
    const key = classroomKey(canonicalLevel(row.level), canonicalGrade(row.grade), canonicalSection(row.section));
    const bucket = lateByKey.get(key) ?? { count: 0, students: new Set<number>() };
    bucket.count += 1;
    bucket.students.add(row.studentId);
    lateByKey.set(key, bucket);

    const list = byStudent.get(row.studentId) ?? [];
    list.push(row);
    byStudent.set(row.studentId, list);

    byDay.set(row.date, (byDay.get(row.date) ?? 0) + 1);
  }

  const allKeys = new Set([...enrolledByKey.keys(), ...lateByKey.keys()]);
  const levels = new Set([...allKeys].map((k) => k.split('|')[0]));
  const multiLevel = levels.size > 1;

  const labelFor = (level: string, grade: string, section: string) => {
    const prefix = multiLevel ? `${LEVEL_SHORT[level.toLowerCase()] ?? level} ` : '';
    return `${prefix}${grade} ${section}`.trim();
  };

  const classrooms: LatenessClassroom[] = [...allKeys].map((key) => {
    const [level, grade, section] = key.split('|');
    const late = lateByKey.get(key);
    const enrolled = enrolledByKey.get(key) ?? 0;
    const studentsLate = late?.students.size ?? 0;
    return {
      key,
      level,
      grade,
      section,
      label: labelFor(level, grade, section),
      lateCount: late?.count ?? 0,
      studentsLate,
      enrolled,
      studentRate: enrolled > 0 ? Math.min(1, studentsLate / enrolled) : null,
    };
  });

  classrooms.sort(
    (a, b) =>
      levelRank(a.level) - levelRank(b.level) ||
      gradeRank(a.grade) - gradeRank(b.grade) ||
      a.grade.localeCompare(b.grade) ||
      a.section.localeCompare(b.section),
  );

  const sections = [...new Set(classrooms.map((c) => c.section))].sort((a, b) => a.localeCompare(b));

  const gradeMap = new Map<string, LatenessGradeRow>();
  for (const c of classrooms) {
    const key = `${c.level}|${c.grade}`;
    const row =
      gradeMap.get(key) ??
      {
        key,
        level: c.level,
        grade: c.grade,
        label: multiLevel ? `${LEVEL_SHORT[c.level.toLowerCase()] ?? c.level} ${c.grade}` : c.grade,
        lateCount: 0,
        cells: {},
      };
    row.lateCount += c.lateCount;
    row.cells[c.section] = c;
    gradeMap.set(key, row);
  }

  const classroomByKey = new Map(classrooms.map((c) => [c.key, c]));

  const students: LatenessStudent[] = [...byStudent.values()].map((list) => {
    const sorted = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const last = sorted[sorted.length - 1];
    const key = classroomKey(canonicalLevel(last.level), canonicalGrade(last.grade), canonicalSection(last.section));
    const minutes = sorted.map((r) => r.minutesLate).filter((m): m is number => m != null);
    return {
      studentId: last.studentId,
      studentName: last.studentName,
      photo: last.photo,
      classroomKey: key,
      classroomLabel: classroomByKey.get(key)?.label ?? `${last.grade} ${last.section}`,
      lateCount: sorted.length,
      justifiedCount: sorted.filter((r) => r.justified).length,
      lastDate: last.date,
      lastTime: last.time,
      avgMinutesLate: average(minutes),
    };
  });

  students.sort(
    (a, b) =>
      b.lateCount - a.lateCount ||
      (b.lastDate + b.lastTime).localeCompare(a.lastDate + a.lastTime) ||
      a.studentName.localeCompare(b.studentName),
  );

  const days = [...byDay.entries()]
    .map(([date, lateCount]) => ({ date, lateCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const allMinutes = rows.map((r) => r.minutesLate).filter((m): m is number => m != null);

  const levelCounts = new Map<string, number>();
  for (const row of rows) {
    const level = canonicalLevel(row.level);
    levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
  }
  const byLevel = [...levelCounts.entries()]
    .sort(([a], [b]) => levelRank(a) - levelRank(b) || a.localeCompare(b))
    .map(([level, value]) => ({ key: level, label: level, value }));

  const byDelay = DELAY_BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : DELAY_BUCKETS[i - 1].max;
    return {
      key: b.key,
      label: b.label,
      value: allMinutes.filter((m) => m > min && m <= b.max).length,
    };
  });

  return {
    totalLate: rows.length,
    studentsLate: byStudent.size,
    justified: rows.filter((r) => r.justified).length,
    avgMinutesLate: average(allMinutes),
    arrivalsTotal,
    lateRate: arrivalsTotal && arrivalsTotal > 0 ? Math.min(1, rows.length / arrivalsTotal) : null,
    sections,
    grades: [...gradeMap.values()],
    classrooms,
    students,
    days,
    maxClassroomLate: Math.max(0, ...classrooms.map((c) => c.lateCount)),
    byLevel,
    byDelay,
  };
}

export type LatenessPeriod = 'today' | 'week' | 'month';

/** Rango YYYY-MM-DD del período del Inicio: hoy, semana en curso (desde el lunes) o mes en curso. */
export function latenessPeriodRange(period: LatenessPeriod, todayKey: string): { dateFrom: string; dateTo: string } {
  const [y, m, d] = todayKey.split('-').map(Number);
  if (period === 'today') return { dateFrom: todayKey, dateTo: todayKey };
  if (period === 'month') return { dateFrom: `${todayKey.slice(0, 7)}-01`, dateTo: todayKey };
  const today = new Date(Date.UTC(y, m - 1, d));
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(y, m - 1, d - sinceMonday));
  return { dateFrom: monday.toISOString().slice(0, 10), dateTo: todayKey };
}

/** Minúsculas y sin tildes, para buscar nombres. */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Paso 0-5 de la escala secuencial del mapa de calor (0 = sin tardanzas). */
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((value / max) * 5)));
}
