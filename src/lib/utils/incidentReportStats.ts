import type { DashboardStats, EducationalLevel, Incident } from '@/types';
import { studentMatchesSearchTokens, tokenizeSearchQuery } from '@/lib/utils/studentSearch';

export function filterIncidentsByStudentName(incidents: Incident[], query: string): Incident[] {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return incidents;
  return incidents.filter((incident) => {
    if (!incident.student) return false;
    return studentMatchesSearchTokens(incident.student, tokens);
  });
}

export function studentNamesFromIncidents(incidents: Incident[]): string[] {
  return [...new Set(incidents.map((i) => i.student?.fullName).filter(Boolean) as string[])];
}

/** KPIs de un subconjunto de incidencias (reporte de un alumno). */
export function buildDashboardStatsFromIncidents(incidents: Incident[]): DashboardStats {
  const studentIds = new Set(incidents.map((i) => i.studentId));
  const levelDistribution = {
    level0: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0,
  };
  const faultCounts = new Map<string, number>();
  const gradeCounts = new Map<string, { level: EducationalLevel; grade: string; count: number }>();

  let reincidenceSum = 0;
  for (const incident of incidents) {
    const lvl = Math.min(5, Math.max(0, incident.reincidenceLevel)) as 0 | 1 | 2 | 3 | 4 | 5;
    levelDistribution[`level${lvl}`] += 1;
    reincidenceSum += incident.reincidenceLevel;
    const faultName = incident.faultType?.name ?? 'Sin tipo';
    faultCounts.set(faultName, (faultCounts.get(faultName) ?? 0) + 1);
    if (incident.student) {
      const key = `${incident.student.level}|${incident.student.grade}`;
      const prev = gradeCounts.get(key);
      if (prev) prev.count += 1;
      else {
        gradeCounts.set(key, {
          level: incident.student.level,
          grade: incident.student.grade,
          count: 1,
        });
      }
    }
  }

  const topFaults = [...faultCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([faultType, count]) => ({ faultType, count }));

  return {
    totalIncidents: incidents.length,
    incidentsToday: 0,
    incidentsThisWeek: 0,
    incidentsThisMonth: incidents.length,
    studentsWithIncidents: studentIds.size,
    averageReincidenceLevel: incidents.length ? reincidenceSum / incidents.length : 0,
    levelDistribution,
    topFaults,
    incidentsByGrade: [...gradeCounts.values()].map((row) => ({
      level: row.level,
      grade: row.grade,
      label: `${row.level} ${row.grade}`,
      count: row.count,
    })),
  };
}
