import type { DashboardStats } from '@/types';
import type { LatenessSummary } from '@/lib/utils/latenessStats';
import type { AbsenceSummary } from '@/lib/utils/absenceStats';

/** Todo lo que necesita el informe exportado (ya filtrado como en la pantalla de Reportes). */
export interface ReportExportData {
  schoolName: string;
  /** «Año escolar 2026» o «Segundo Bimestre (…)». */
  periodLabel: string;
  /** Filtros aplicados en texto: «Nivel: Primaria · Grado: 3ro». */
  filterText: string;
  /** Si el reporte es de un solo estudiante. */
  studentName?: string;
  stats: DashboardStats;
  monthlyTrend: { month: string; incidents: number }[];
  weeklyData: { day: string; count: number }[];
  byGrade: {
    grade: string;
    level: string;
    label: string;
    totalIncidents: number;
    studentsWithIncidents: number;
    averageReincidence: number;
    levelDistribution: { level0: number; level1: number; level2: number; level3: number; level4: number };
  }[];
  bySection: {
    section: string;
    grade: string;
    level: string;
    label: string;
    totalIncidents: number;
    studentsWithIncidents: number;
    averageReincidence: number;
  }[];
  lateness: LatenessSummary | null;
  /** Faltas (inasistencias) del período; opcional. */
  absences?: AbsenceSummary | null;
}

export interface LatenessMonth {
  month: string;
  label: string;
  lateCount: number;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function monthLabel(yyyyMm: string): string {
  const m = Number(yyyyMm.slice(5, 7));
  return MONTHS[m - 1] ?? yyyyMm;
}

/** Tardanzas agrupadas por mes (a partir de la serie diaria). */
export function latenessByMonth(lateness: LatenessSummary | null): LatenessMonth[] {
  if (!lateness) return [];
  const map = new Map<string, number>();
  for (const d of lateness.days) {
    const key = d.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + d.lateCount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, lateCount]) => ({ month, label: monthLabel(month), lateCount }));
}

function pct(part: number, total: number, digits = 0): string {
  return total > 0 ? `${((part / total) * 100).toFixed(digits)}%` : '0%';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export interface ReportInsights {
  /** Frases del resumen ejecutivo, en orden de lectura. */
  summary: string[];
  /** Puntos que piden atención (pueden estar vacíos). */
  alerts: string[];
  incidents: {
    total: number;
    students: number;
    critical: number;
    peakMonth: { month: string; incidents: number } | null;
    average: number;
    lastVsPrevious: { last: string; current: number; previous: number; change: number | null } | null;
    topFault: { faultType: string; count: number } | null;
    top3Share: number;
    topGrade: { label: string; totalIncidents: number } | null;
    topSection: { label: string; totalIncidents: number } | null;
    peakWeekday: { day: string; count: number } | null;
  };
  lateness: {
    total: number;
    students: number;
    rate: number | null;
    avgMinutes: number | null;
    topClassroom: { label: string; lateCount: number; studentRate: number | null; studentsLate: number; enrolled: number } | null;
    peakMonth: LatenessMonth | null;
    topStudent: { studentName: string; classroomLabel: string; lateCount: number } | null;
    months: LatenessMonth[];
  } | null;
  absences: {
    total: number;
    justified: number;
    students: number;
    attendanceRate: number | null;
    schoolDays: number;
    topClassroom: { label: string; lateCount: number; studentsLate: number; enrolled: number; studentRate: number | null } | null;
    topStudent: { studentName: string; classroomLabel: string; absences: number } | null;
    months: LatenessMonth[];
  } | null;
}

/** Arma las cifras clave y las frases del resumen ejecutivo. */
export function buildReportInsights(data: ReportExportData): ReportInsights {
  const { stats, monthlyTrend, weeklyData, byGrade, bySection, lateness } = data;
  const total = stats.totalIncidents;
  const ld = stats.levelDistribution;
  const critical = (ld.level3 ?? 0) + (ld.level4 ?? 0) + (ld.level5 ?? 0);

  const withData = monthlyTrend.filter((m) => m.incidents > 0);
  const peakMonth = withData.length > 0 ? withData.reduce((b, m) => (m.incidents > b.incidents ? m : b)) : null;
  const average = monthlyTrend.length > 0 ? monthlyTrend.reduce((s, m) => s + m.incidents, 0) / monthlyTrend.length : 0;
  const lastVsPrevious =
    monthlyTrend.length >= 2
      ? (() => {
          const cur = monthlyTrend[monthlyTrend.length - 1];
          const prev = monthlyTrend[monthlyTrend.length - 2];
          return {
            last: cur.month,
            current: cur.incidents,
            previous: prev.incidents,
            change: prev.incidents > 0 ? (cur.incidents - prev.incidents) / prev.incidents : null,
          };
        })()
      : null;

  const topFault = stats.topFaults[0] ?? null;
  const top3Share = total > 0 ? stats.topFaults.slice(0, 3).reduce((s, f) => s + f.count, 0) / total : 0;
  const topGrade = byGrade.length > 0 ? byGrade.reduce((b, g) => (g.totalIncidents > b.totalIncidents ? g : b)) : null;
  const topSection = bySection.length > 0 ? bySection.reduce((b, s) => (s.totalIncidents > b.totalIncidents ? s : b)) : null;
  const peakWeekday =
    weeklyData.length > 0 && weeklyData.some((d) => d.count > 0)
      ? weeklyData.reduce((b, d) => (d.count > b.count ? d : b))
      : null;

  const summary: string[] = [];
  const alerts: string[] = [];
  const who = data.studentName ? `${data.studentName} registra` : 'Se registraron';

  if (total === 0) {
    summary.push(`No se registraron incidencias en ${data.periodLabel.toLowerCase()}.`);
  } else {
    summary.push(
      data.studentName
        ? `${who} ${plural(total, 'incidencia', 'incidencias')} en el período, con un nivel de reincidencia promedio de ${stats.averageReincidenceLevel.toFixed(1)}.`
        : `${who} ${plural(total, 'incidencia', 'incidencias')} de ${plural(stats.studentsWithIncidents, 'estudiante', 'estudiantes')}, con un nivel de reincidencia promedio de ${stats.averageReincidenceLevel.toFixed(1)}.`,
    );
    if (peakMonth) {
      let s = `El mes con más incidencias fue ${peakMonth.month} (${peakMonth.incidents}${average > 0 ? `, ${(peakMonth.incidents / average).toFixed(1)} veces el promedio mensual` : ''}).`;
      if (lastVsPrevious && lastVsPrevious.change != null && lastVsPrevious.change !== 0) {
        s += ` En ${lastVsPrevious.last} ${lastVsPrevious.change > 0 ? 'subieron' : 'bajaron'} ${pct(Math.abs(lastVsPrevious.change), 1)} respecto al mes anterior.`;
      }
      summary.push(s);
    }
    if (topFault) {
      summary.push(
        `La falta más frecuente es «${topFault.faultType}» (${topFault.count}, ${pct(topFault.count, total)} del total)` +
          (stats.topFaults.length >= 3 ? `; las tres más comunes suman el ${pct(top3Share, 1)}.` : '.'),
      );
    }
    if (!data.studentName && topGrade && topGrade.totalIncidents > 0) {
      summary.push(
        `${topGrade.label} es el grado con más incidencias (${topGrade.totalIncidents})` +
          (topSection && topSection.totalIncidents > 0
            ? ` y la sección con más es ${topSection.label.replace(' • ', ' ')} (${topSection.totalIncidents}).`
            : '.'),
      );
    }
    if (critical > 0) {
      alerts.push(
        `${plural(critical, 'caso crítico', 'casos críticos')} (nivel de reincidencia 3 o más), ${pct(critical, total)} del total: requieren seguimiento de tutoría y coordinación.`,
      );
    }
    if (top3Share >= 0.5 && stats.topFaults.length >= 3) {
      alerts.push(`Tres tipos de falta concentran más de la mitad de las incidencias: atenderlos primero tiene el mayor efecto.`);
    }
  }

  let latenessInsights: ReportInsights['lateness'] = null;
  if (lateness && !data.studentName) {
    const months = latenessByMonth(lateness);
    const peakLate = months.length > 0 ? months.reduce((b, m) => (m.lateCount > b.lateCount ? m : b)) : null;
    const topClassroom = [...lateness.classrooms].sort((a, b) => b.lateCount - a.lateCount)[0];
    const topStudent = lateness.students[0] ?? null;

    latenessInsights = {
      total: lateness.totalLate,
      students: lateness.studentsLate,
      rate: lateness.lateRate,
      avgMinutes: lateness.avgMinutesLate,
      topClassroom: topClassroom && topClassroom.lateCount > 0 ? topClassroom : null,
      peakMonth: peakLate && peakLate.lateCount > 0 ? peakLate : null,
      topStudent,
      months,
    };

    if (lateness.totalLate === 0) {
      summary.push('No hubo tardanzas en el período.');
    } else {
      summary.push(
        `Hubo ${plural(lateness.totalLate, 'tardanza', 'tardanzas')} de ${plural(lateness.studentsLate, 'estudiante', 'estudiantes')}` +
          (lateness.lateRate != null ? ` (${pct(lateness.lateRate, 1, 1)} de las llegadas registradas)` : '') +
          (lateness.avgMinutesLate != null ? `, con ${Math.round(lateness.avgMinutesLate)} minutos de retraso promedio.` : '.'),
      );
      if (latenessInsights.topClassroom) {
        const c = latenessInsights.topClassroom;
        summary.push(
          `El aula con más tardanzas es ${c.label} (${c.lateCount}` +
            (c.studentRate != null ? `; ${pct(c.studentRate, 1)} de sus estudiantes llegó tarde al menos una vez` : '') +
            ')' +
            (latenessInsights.peakMonth ? ` y el mes con más tardanzas fue ${latenessInsights.peakMonth.label} (${latenessInsights.peakMonth.lateCount}).` : '.'),
        );
      }
      if (topStudent && topStudent.lateCount >= 3) {
        alerts.push(
          `${topStudent.studentName} (${topStudent.classroomLabel}) acumula ${topStudent.lateCount} tardanzas: conviene citar al apoderado.`,
        );
      }
      if (latenessInsights.topClassroom?.studentRate != null && latenessInsights.topClassroom.studentRate >= 0.3) {
        alerts.push(
          `En ${latenessInsights.topClassroom.label} llegó tarde el ${pct(latenessInsights.topClassroom.studentRate, 1)} del aula: revisar con su tutor.`,
        );
      }
    }
  }

  let absenceInsights: ReportInsights['absences'] = null;
  const absences = data.absences;
  if (absences && !data.studentName && absences.schoolDays.length > 0) {
    const monthMap = new Map<string, number>();
    for (const d of absences.days) monthMap.set(d.date.slice(0, 7), (monthMap.get(d.date.slice(0, 7)) ?? 0) + d.lateCount);
    const months = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, lateCount]) => ({ month, label: monthLabel(month), lateCount }));
    const topRoom = [...absences.classrooms].sort((a, b) => b.lateCount - a.lateCount)[0];
    const topSt = absences.students[0];
    absenceInsights = {
      total: absences.totalAbsences,
      justified: absences.justified,
      students: absences.studentsWithAbsences,
      attendanceRate: absences.attendanceRate,
      schoolDays: absences.schoolDays.length,
      topClassroom: topRoom && topRoom.lateCount > 0 ? topRoom : null,
      topStudent: topSt && topSt.absences > 0 ? topSt : null,
      months,
    };
    if (absences.totalAbsences === 0) {
      summary.push(`No hubo faltas en los ${absences.schoolDays.length} días con clases del período.`);
    } else {
      summary.push(
        `Se registraron ${plural(absences.totalAbsences, 'falta', 'faltas')} de ${plural(absences.studentsWithAbsences, 'estudiante', 'estudiantes')} en ${absences.schoolDays.length} días con clases` +
          (absences.attendanceRate != null ? `; la asistencia fue del ${pct(absences.attendanceRate, 1, 1)}` : '') +
          (absenceInsights.topClassroom ? ` y el aula con más faltas es ${absenceInsights.topClassroom.label} (${absenceInsights.topClassroom.lateCount}).` : '.'),
      );
      if (topSt && topSt.absences >= 3) {
        alerts.push(`${topSt.studentName} (${topSt.classroomLabel}) acumula ${topSt.absences} faltas: conviene comunicarse con el apoderado.`);
      }
    }
  }

  return {
    summary,
    alerts,
    absences: absenceInsights,
    incidents: {
      total,
      students: stats.studentsWithIncidents,
      critical,
      peakMonth,
      average,
      lastVsPrevious,
      topFault,
      top3Share,
      topGrade,
      topSection,
      peakWeekday,
    },
    lateness: latenessInsights,
  };
}
