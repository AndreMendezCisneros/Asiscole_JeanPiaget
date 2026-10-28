import { describe, expect, it } from 'vitest';
import { buildLatenessSummary } from '@/lib/utils/latenessStats';
import { buildReportInsights, latenessByMonth, type ReportExportData } from './reportInsights';

const lateness = buildLatenessSummary(
  [
    { recordId: 1, studentId: 1, studentName: 'Ana Ruiz', photo: null, level: 'Primaria', grade: '2do', section: 'B', date: '2026-09-10', time: '08:10', justified: false, minutesLate: 10 },
    { recordId: 2, studentId: 1, studentName: 'Ana Ruiz', photo: null, level: 'Primaria', grade: '2do', section: 'B', date: '2026-09-11', time: '08:20', justified: false, minutesLate: 20 },
    { recordId: 3, studentId: 1, studentName: 'Ana Ruiz', photo: null, level: 'Primaria', grade: '2do', section: 'B', date: '2026-10-01', time: '08:05', justified: false, minutesLate: 5 },
    { recordId: 4, studentId: 2, studentName: 'Beto Paz', photo: null, level: 'Primaria', grade: '1ro', section: 'A', date: '2026-10-02', time: '08:05', justified: true, minutesLate: 5 },
  ],
  [
    { level: 'Primaria', grade: '2do', section: 'B', students: 5 },
    { level: 'Primaria', grade: '1ro', section: 'A', students: 20 },
  ],
  100,
);

const data: ReportExportData = {
  schoolName: 'IEP Prueba',
  periodLabel: 'Año escolar 2026',
  filterText: '',
  stats: {
    totalIncidents: 20,
    incidentsToday: 0,
    incidentsThisWeek: 0,
    incidentsThisMonth: 0,
    studentsWithIncidents: 8,
    averageReincidenceLevel: 1.4,
    levelDistribution: { level0: 8, level1: 5, level2: 3, level3: 3, level4: 1, level5: 0 },
    topFaults: [
      { faultType: 'Uniforme', count: 8 },
      { faultType: 'Celular', count: 4 },
      { faultType: 'Tareas', count: 2 },
    ],
    incidentsByGrade: [],
  },
  monthlyTrend: [
    { month: 'Ago', incidents: 4 },
    { month: 'Sep', incidents: 10 },
    { month: 'Oct', incidents: 6 },
  ],
  weeklyData: [
    { day: 'Lun', count: 1 },
    { day: 'Mar', count: 3 },
  ],
  byGrade: [
    { grade: '1ro', level: 'Primaria', label: 'Primaria 1ro', totalIncidents: 5, studentsWithIncidents: 3, averageReincidence: 1, levelDistribution: { level0: 5, level1: 0, level2: 0, level3: 0, level4: 0 } },
    { grade: '2do', level: 'Primaria', label: 'Primaria 2do', totalIncidents: 15, studentsWithIncidents: 5, averageReincidence: 2, levelDistribution: { level0: 3, level1: 5, level2: 3, level3: 3, level4: 1 } },
  ],
  bySection: [{ section: 'B', grade: '2do', level: 'Primaria', label: 'Primaria • 2do B', totalIncidents: 9, studentsWithIncidents: 3, averageReincidence: 2 }],
  lateness,
};

describe('latenessByMonth', () => {
  it('agrupa la serie diaria por mes', () => {
    expect(latenessByMonth(lateness)).toEqual([
      { month: '2026-09', label: 'septiembre', lateCount: 2 },
      { month: '2026-10', label: 'octubre', lateCount: 2 },
    ]);
  });
});

describe('buildReportInsights', () => {
  const r = buildReportInsights(data);

  it('cifras clave de incidencias', () => {
    expect(r.incidents.critical).toBe(4);
    expect(r.incidents.peakMonth).toEqual({ month: 'Sep', incidents: 10 });
    expect(r.incidents.top3Share).toBeCloseTo(0.7);
    expect(r.incidents.topGrade?.label).toBe('Primaria 2do');
    expect(r.incidents.lastVsPrevious?.change).toBeCloseTo(-0.4);
  });

  it('cifras clave de tardanzas', () => {
    expect(r.lateness?.topClassroom?.label).toBe('2do B');
    expect(r.lateness?.topStudent?.studentName).toBe('Ana Ruiz');
    expect(r.lateness?.peakMonth?.label).toBe('septiembre');
  });

  it('redacta el resumen y las alertas', () => {
    const text = r.summary.join(' ');
    expect(text).toContain('20 incidencias de 8 estudiantes');
    expect(text).toContain('El mes con más incidencias fue Sep (10');
    expect(text).toContain('bajaron 40%');
    expect(text).toContain('«Uniforme»');
    expect(text).toContain('sección con más es Primaria 2do B (9)');
    expect(text).toContain('El aula con más tardanzas es 2do B (3; 20% de sus estudiantes');
    expect(r.alerts.some((a) => a.includes('4 casos críticos'))).toBe(true);
    expect(r.alerts.some((a) => a.includes('Ana Ruiz (2do B) acumula 3 tardanzas'))).toBe(true);
  });

  it('en modo estudiante omite comparativas y tardanzas', () => {
    const s = buildReportInsights({ ...data, studentName: 'Ana Ruiz' });
    expect(s.lateness).toBeNull();
    expect(s.summary[0]).toContain('Ana Ruiz registra 20 incidencias');
    expect(s.summary.join(' ')).not.toContain('grado con más');
  });
});
