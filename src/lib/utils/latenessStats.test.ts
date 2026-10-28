import { describe, expect, it } from 'vitest';
import {
  buildLatenessSummary,
  canonicalGrade,
  heatStep,
  latenessPeriodRange,
  minutesBetween,
  normalizeSearchText,
  type LatenessRow,
} from './latenessStats';

function row(partial: Partial<LatenessRow>): LatenessRow {
  return {
    recordId: 1,
    studentId: 1,
    studentName: 'Ana',
    photo: null,
    level: 'Primaria',
    grade: '1ro',
    section: 'A',
    date: '2026-10-01',
    time: '08:10',
    justified: false,
    minutesLate: 10,
    ...partial,
  };
}

describe('canonicalGrade', () => {
  it('une «4» y «4to»', () => {
    expect(canonicalGrade('4')).toBe('4to');
    expect(canonicalGrade(' 4to ')).toBe('4to');
    expect(canonicalGrade('Inicial 3 años')).toBe('Inicial 3 años');
  });
});

describe('minutesBetween', () => {
  it('calcula minutos tras la hora límite', () => {
    expect(minutesBetween('08:12:30', '08:00')).toBe(12);
    expect(minutesBetween('07:50', '08:00')).toBe(0);
  });
});

describe('heatStep', () => {
  it('0 sin tardanzas y 5 en el máximo', () => {
    expect(heatStep(0, 10)).toBe(0);
    expect(heatStep(1, 10)).toBe(1);
    expect(heatStep(10, 10)).toBe(5);
  });
});

describe('buildLatenessSummary', () => {
  const rows = [
    row({ recordId: 1, studentId: 1, date: '2026-10-01', minutesLate: 10 }),
    row({ recordId: 2, studentId: 1, date: '2026-10-02', time: '08:20', minutesLate: 20, justified: true }),
    row({ recordId: 3, studentId: 2, studentName: 'Beto', grade: '1', section: 'b', minutesLate: 5 }),
    row({ recordId: 4, studentId: 3, studentName: 'Caro', level: 'Secundaria', grade: '3ro', section: 'A', minutesLate: null }),
  ];
  const enrollment = [
    { level: 'Primaria', grade: '1ro', section: 'A', students: 20 },
    { level: 'Primaria', grade: '1ro', section: 'B', students: 10 },
    { level: 'Primaria', grade: '2do', section: 'A', students: 25 },
    { level: 'Secundaria', grade: '3ro', section: 'A', students: 30 },
  ];

  const summary = buildLatenessSummary(rows, enrollment, 200);

  it('totales', () => {
    expect(summary.totalLate).toBe(4);
    expect(summary.studentsLate).toBe(3);
    expect(summary.justified).toBe(1);
    expect(summary.lateRate).toBeCloseTo(0.02);
    expect(summary.avgMinutesLate).toBeCloseTo(35 / 3);
  });

  it('agrupa por aula normalizando grado y sección, e incluye aulas sin tardanzas', () => {
    const labels = summary.classrooms.map((c) => `${c.label}:${c.lateCount}`);
    expect(labels).toEqual(['Prim. 1ro A:2', 'Prim. 1ro B:1', 'Prim. 2do A:0', 'Sec. 3ro A:1']);
    const a = summary.classrooms[0];
    expect(a.studentsLate).toBe(1);
    expect(a.studentRate).toBeCloseTo(1 / 20);
    expect(summary.maxClassroomLate).toBe(2);
  });

  it('arma filas por grado con celdas por sección', () => {
    expect(summary.sections).toEqual(['A', 'B']);
    expect(summary.grades.map((g) => `${g.label}:${g.lateCount}`)).toEqual([
      'Prim. 1ro:3',
      'Prim. 2do:0',
      'Sec. 3ro:1',
    ]);
    expect(summary.grades[1].cells.B).toBeUndefined();
  });

  it('ordena alumnos por número de tardanzas y guarda la última llegada', () => {
    const [first] = summary.students;
    expect(first.studentName).toBe('Ana');
    expect(first.lateCount).toBe(2);
    expect(first.justifiedCount).toBe(1);
    expect(first.lastDate).toBe('2026-10-02');
    expect(first.lastTime).toBe('08:20');
    expect(first.avgMinutesLate).toBe(15);
    expect(first.classroomLabel).toBe('Prim. 1ro A');
  });

  it('serie diaria', () => {
    expect(summary.days).toEqual([
      { date: '2026-10-01', lateCount: 3 },
      { date: '2026-10-02', lateCount: 1 },
    ]);
  });

  it('sin llegadas registradas no inventa porcentaje', () => {
    expect(buildLatenessSummary([], [], 0).lateRate).toBeNull();
  });
});

describe('latenessPeriodRange', () => {
  it('hoy, semana desde el lunes y mes en curso', () => {
    // 2026-10-28 es miércoles
    expect(latenessPeriodRange('today', '2026-10-28')).toEqual({ dateFrom: '2026-10-28', dateTo: '2026-10-28' });
    expect(latenessPeriodRange('week', '2026-10-28')).toEqual({ dateFrom: '2026-10-26', dateTo: '2026-10-28' });
    expect(latenessPeriodRange('week', '2026-11-01')).toEqual({ dateFrom: '2026-10-26', dateTo: '2026-11-01' });
    expect(latenessPeriodRange('month', '2026-10-28')).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-28' });
  });
});

describe('normalizeSearchText', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(normalizeSearchText('  José PÉREZ ')).toBe('jose perez');
  });
});
