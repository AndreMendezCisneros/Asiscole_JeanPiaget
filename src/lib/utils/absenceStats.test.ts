import { describe, expect, it } from 'vitest';
import { buildAbsenceSummary, schoolDaysFrom } from './absenceStats';

const students = [
  { id: 1, name: 'Ana', level: 'Primaria', grade: '1ro', section: 'A' },
  { id: 2, name: 'Beto', level: 'Primaria', grade: '1', section: 'A' },
  { id: 3, name: 'Caro', level: 'Primaria', grade: '2do', section: 'B' },
];

// lun 19, mar 20, mié 21 (nadie registró), sáb 24 (no hábil), mié 28 = hoy (no cerrado)
const arrivals = [
  { studentId: 1, date: '2026-10-19', estado: 'A tiempo' },
  { studentId: 2, date: '2026-10-19', estado: 'Tarde' },
  { studentId: 1, date: '2026-10-20', estado: 'A tiempo' },
  { studentId: 3, date: '2026-10-20', estado: 'Falta justificada' },
  { studentId: 1, date: '2026-10-24', estado: 'A tiempo' },
  { studentId: 1, date: '2026-10-28', estado: 'A tiempo' },
];

describe('schoolDaysFrom', () => {
  it('solo días hábiles, cerrados y con asistencia tomada', () => {
    expect(schoolDaysFrom(arrivals, '2026-10-01', '2026-10-31', '2026-10-28')).toEqual(['2026-10-19', '2026-10-20']);
  });
});

describe('buildAbsenceSummary', () => {
  const days = schoolDaysFrom(arrivals, '2026-10-01', '2026-10-31', '2026-10-28');
  const s = buildAbsenceSummary(students, arrivals, days);

  it('cuenta faltas sin registro y justificadas', () => {
    const byName = Object.fromEntries(s.students.map((x) => [x.studentName, x]));
    expect(byName.Ana.absences).toBe(0);
    expect(byName.Beto.absences).toBe(1);
    expect(byName.Beto.dates).toEqual(['2026-10-20']);
    expect(byName.Caro.absences).toBe(2);
    expect(byName.Caro.justified).toBe(1);
    expect(byName.Caro.attendanceRate).toBe(0);
    expect(s.totalAbsences).toBe(3);
    expect(s.justified).toBe(1);
    expect(s.studentsWithAbsences).toBe(2);
    expect(s.attendanceRate).toBeCloseTo(3 / 6);
  });

  it('agrupa por aula uniendo «1» y «1ro»', () => {
    expect(s.classrooms.map((c) => `${c.label}:${c.lateCount}:${c.studentsLate}/${c.enrolled}`)).toEqual(['1ro A:1:1/2', '2do B:2:1/1']);
    expect(s.days).toEqual([
      { date: '2026-10-19', lateCount: 1 },
      { date: '2026-10-20', lateCount: 2 },
    ]);
  });
});
