import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Incident } from '@/types';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { getReincidenceLevelBarColor, getReincidenceLevelSummaryLabel } from '@/lib/utils/reincidenceUtils';
import type { ReincidenceLevel } from '@/types';
import { buildReportInsights, type ReportExportData } from './reportInsights';
import {
  areaTrendChart,
  BLUE_RAMP,
  CHART_COLORS,
  donutChart,
  heatmapChart,
  horizontalBarChart,
  ORANGE_RAMP,
  stackedBarChart,
  verticalBarChart,
} from './chartImages';

const LEVEL_KEYS = ['level0', 'level1', 'level2', 'level3', 'level4', 'level5'] as const;
const LATE_DELAY_COLORS = ['#f9c4a7', '#f39a73', '#d4501f', '#a0321a'];
const LEVEL_SHORT: Record<string, string> = { Primaria: 'Prim.', Secundaria: 'Sec.', Inicial: 'Inic.' };

function pct(part: number, total: number, digits = 1): string {
  return total > 0 ? `${((part / total) * 100).toFixed(digits)}%` : '0%';
}

function minutes(m: number | null): string {
  if (m == null) return '—';
  const r = Math.round(m);
  return r < 60 ? `${r} min` : `${Math.floor(r / 60)} h ${r % 60} min`;
}

/** Filas grado × sección para el mapa de calor. */
function sectionGrid<T extends { level: string; grade: string; section: string }>(
  rows: T[],
  value: (r: T) => number,
  note?: (r: T) => string | null,
) {
  const multiLevel = new Set(rows.map((r) => r.level)).size > 1;
  const sections = [...new Set(rows.map((r) => r.section))].sort((a, b) => a.localeCompare(b));
  const grades: { key: string; label: string; cells: Map<string, T> }[] = [];
  for (const r of rows) {
    const key = `${r.level}|${r.grade}`;
    let g = grades.find((x) => x.key === key);
    if (!g) {
      g = { key, label: multiLevel ? `${LEVEL_SHORT[r.level] ?? r.level} ${r.grade}` : r.grade, cells: new Map() };
      grades.push(g);
    }
    g.cells.set(r.section, r);
  }
  return {
    sections,
    rows: grades.map((g) => ({
      label: g.label,
      cells: sections.map((s) => (g.cells.has(s) ? value(g.cells.get(s)!) : null)),
      notes: note ? sections.map((s) => (g.cells.has(s) ? note(g.cells.get(s)!) : null)) : undefined,
    })),
  };
}

/**
 * Informe en PDF: portada con cifras, resumen ejecutivo, incidencias y tardanzas con gráficos,
 * lectura y tablas completas, y anexo con el detalle de cada incidencia.
 */
export async function exportFullReportPdf(data: ReportExportData, incidents: Incident[]): Promise<void> {
  const insights = buildReportInsights(data);
  const { stats } = data;
  const total = stats.totalIncidents;
  const isStudent = Boolean(data.studentName);

  const subtitle = buildFilterSubtitle([
    data.schoolName,
    data.periodLabel,
    data.studentName ? `Estudiante: ${data.studentName}` : data.filterText || 'Todos los niveles, grados y secciones',
  ]);
  const doc = new PdfReportDocument(
    'portrait',
    isStudent ? 'INFORME DEL ESTUDIANTE' : 'INFORME DE CONVIVENCIA Y PUNTUALIDAD',
    subtitle,
  );
  await doc.drawCoverHeader();

  doc.drawParagraph(
    `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}. ` +
      'Las cifras respetan los filtros elegidos en la página de Reportes.',
    8.5,
  );

  // ── Cifras clave
  doc.drawKpiCards([
    { label: 'Incidencias', value: total, tone: 'primary' },
    { label: isStudent ? 'Nivel promedio' : 'Estudiantes', value: isStudent ? stats.averageReincidenceLevel.toFixed(1) : stats.studentsWithIncidents, tone: 'info' },
    { label: 'Casos críticos', value: insights.incidents.critical, tone: insights.incidents.critical > 0 ? 'error' : 'success' },
    { label: 'Mes pico', value: insights.incidents.peakMonth?.month ?? '—', tone: 'neutral' },
  ]);
  if (insights.lateness) {
    const l = insights.lateness;
    doc.drawKpiCards([
      { label: 'Tardanzas', value: l.total, tone: 'warning' },
      { label: 'Estudiantes con tardanza', value: l.students, tone: 'warning' },
      { label: '% de llegadas tarde', value: l.rate == null ? '—' : pct(l.rate, 1), tone: 'neutral' },
      { label: 'Aula con más tardanzas', value: l.topClassroom?.label ?? '—', tone: 'neutral' },
    ]);
  }

  doc.drawBulletBox('Resumen ejecutivo', insights.summary);
  doc.drawBulletBox('Puntos de atención', insights.alerts, 'warning');

  // ── 1. Incidencias
  doc.drawSectionTitle('1. Incidencias');

  if (data.monthlyTrend.length > 0) {
    doc.drawSubheading('1.1 Evolución mensual', 'Línea punteada: promedio del período');
    doc.drawChartImage(areaTrendChart(data.monthlyTrend.map((m) => ({ label: m.month, value: m.incidents }))));
    const { peakMonth, average, lastVsPrevious } = insights.incidents;
    if (peakMonth) {
      doc.drawInsight(
        `${peakMonth.month} fue el mes con más incidencias (${peakMonth.incidents}), frente a un promedio de ${average.toFixed(1)} por mes.` +
          (lastVsPrevious && lastVsPrevious.change != null
            ? ` El último mes (${lastVsPrevious.last}) ${lastVsPrevious.change > 0 ? 'subió' : lastVsPrevious.change < 0 ? 'bajó' : 'se mantuvo'} ${lastVsPrevious.change !== 0 ? pct(Math.abs(lastVsPrevious.change), 1, 0) + ' ' : ''}respecto al anterior (de ${lastVsPrevious.previous} a ${lastVsPrevious.current}).`
            : ''),
      );
    }
    doc.drawTable(
      [
        { header: 'Mes', dataKey: 'month' },
        { header: 'Incidencias', dataKey: 'n', align: 'right' },
        { header: 'Frente al promedio', dataKey: 'vs', align: 'right' },
        { header: 'Variación mensual', dataKey: 'var', align: 'right' },
      ],
      data.monthlyTrend.map((m, i) => {
        const prev = i > 0 ? data.monthlyTrend[i - 1].incidents : null;
        const diff = m.incidents - average;
        return {
          month: m.month,
          n: m.incidents,
          vs: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`,
          var: prev == null ? '—' : prev === 0 ? (m.incidents > 0 ? 'nuevo' : '0%') : `${m.incidents >= prev ? '+' : ''}${(((m.incidents - prev) / prev) * 100).toFixed(0)}%`,
        };
      }),
      { fontSize: 8 },
    );
  }

  if (!isStudent && data.weeklyData.some((d) => d.count > 0)) {
    doc.drawSubheading('1.2 Incidencias por día de la semana', 'Semana en curso');
    doc.drawChartImage(
      verticalBarChart(data.weeklyData.map((d) => ({ label: d.day, value: d.count })), { highlightMax: true, height: 200 }),
      doc.contentWidth * 0.8,
    );
    const pk = insights.incidents.peakWeekday;
    const wTotal = data.weeklyData.reduce((s, d) => s + d.count, 0);
    if (pk) doc.drawInsight(`${pk.day} concentra ${pct(pk.count, wTotal, 0)} de las incidencias de la semana (${pk.count} de ${wTotal}).`);
  }

  doc.drawSubheading(isStudent ? '1.2 Gravedad (nivel de reincidencia)' : '1.3 Gravedad (nivel de reincidencia)');
  const levelRows = LEVEL_KEYS.map((k, i) => ({
    level: i,
    label: `Nivel ${i} · ${getReincidenceLevelSummaryLabel(i as ReincidenceLevel)}`,
    value: stats.levelDistribution[k] ?? 0,
  })).filter((r) => r.level < 5 || r.value > 0);
  doc.drawChartImage(
    donutChart(
      levelRows.map((r) => ({ label: r.label, value: r.value, color: getReincidenceLevelBarColor(r.level) })),
      { width: 520, height: 200, centerLabel: 'incidencias' },
    ),
    doc.contentWidth * 0.78,
  );
  doc.drawInsight(
    insights.incidents.critical > 0
      ? `${insights.incidents.critical} incidencias (${pct(insights.incidents.critical, total, 0)}) están en nivel 3 o más: son los casos que requieren seguimiento de tutoría y coordinación.`
      : 'No hay casos en nivel 3 o más en el período.',
  );

  if (stats.topFaults.length > 0) {
    doc.drawSubheading(isStudent ? '1.3 Faltas más frecuentes' : '1.4 Faltas más frecuentes', '% del total de incidencias');
    const faults = stats.topFaults.slice(0, 10);
    doc.drawChartImage(
      horizontalBarChart(
        faults.map((f) => ({ label: f.faultType, value: f.count })),
        { strongTop: 3, valueFormatter: (v) => `${v} · ${pct(v, total, 0)}` },
      ),
    );
    if (stats.topFaults.length >= 3) {
      doc.drawInsight(
        `Las tres faltas más comunes suman el ${pct(insights.incidents.top3Share, 1, 0)} de las incidencias. Atenderlas primero es lo que más reduce el total.`,
      );
    }
    let acc = 0;
    doc.drawTable(
      [
        { header: '#', dataKey: 'rank', width: 10, align: 'center' },
        { header: 'Tipo de falta', dataKey: 'fault' },
        { header: 'Cantidad', dataKey: 'count', width: 22, align: 'right' },
        { header: '% del total', dataKey: 'pct', width: 24, align: 'right' },
        { header: '% acumulado', dataKey: 'acc', width: 26, align: 'right' },
      ],
      stats.topFaults.map((f, i) => {
        acc += f.count;
        return { rank: i + 1, fault: f.faultType, count: f.count, pct: pct(f.count, total), acc: pct(acc, total, 0) };
      }),
      { fontSize: 8 },
    );
  }

  if (!isStudent && data.byGrade.length > 0) {
    doc.drawSubheading('1.5 Comparativa por grados', 'Barras apiladas por nivel de reincidencia');
    const multi = new Set(data.byGrade.map((g) => g.level)).size > 1;
    doc.drawChartImage(
      stackedBarChart(
        data.byGrade.map((g) => (multi ? `${LEVEL_SHORT[g.level] ?? g.level} ${g.grade}` : g.grade)),
        (['level0', 'level1', 'level2', 'level3', 'level4'] as const).map((k, i) => ({
          label: `Nivel ${i}`,
          color: getReincidenceLevelBarColor(i),
          values: data.byGrade.map((g) => g.levelDistribution[k]),
        })),
      ),
    );
    if (insights.incidents.topGrade) {
      const worstRatio = [...data.byGrade]
        .filter((g) => g.studentsWithIncidents > 0)
        .sort((a, b) => b.totalIncidents / b.studentsWithIncidents - a.totalIncidents / a.studentsWithIncidents)[0];
      doc.drawInsight(
        `${insights.incidents.topGrade.label} concentra más incidencias (${insights.incidents.topGrade.totalIncidents}, ${pct(insights.incidents.topGrade.totalIncidents, total, 0)} del total).` +
          (worstRatio
            ? ` En ${worstRatio.label} cada estudiante involucrado acumula ${(worstRatio.totalIncidents / worstRatio.studentsWithIncidents).toFixed(1)} incidencias en promedio.`
            : ''),
      );
    }
    doc.drawTable(
      [
        { header: 'Grado', dataKey: 'label' },
        { header: 'Incid.', dataKey: 'total', width: 15, align: 'right' },
        { header: 'Estud.', dataKey: 'students', width: 15, align: 'right' },
        { header: 'Por estud.', dataKey: 'ratio', width: 18, align: 'right' },
        { header: 'Niv. prom.', dataKey: 'avg', width: 18, align: 'right' },
        { header: 'N0', dataKey: 'l0', width: 11, align: 'center' },
        { header: 'N1', dataKey: 'l1', width: 11, align: 'center' },
        { header: 'N2', dataKey: 'l2', width: 11, align: 'center' },
        { header: 'N3', dataKey: 'l3', width: 11, align: 'center' },
        { header: 'N4', dataKey: 'l4', width: 11, align: 'center' },
      ],
      data.byGrade.map((g) => ({
        label: g.label,
        total: g.totalIncidents,
        students: g.studentsWithIncidents,
        ratio: g.studentsWithIncidents > 0 ? (g.totalIncidents / g.studentsWithIncidents).toFixed(1) : '—',
        avg: g.averageReincidence.toFixed(2),
        l0: g.levelDistribution.level0,
        l1: g.levelDistribution.level1,
        l2: g.levelDistribution.level2,
        l3: g.levelDistribution.level3,
        l4: g.levelDistribution.level4,
      })),
      { fontSize: 7.5 },
    );
  }

  if (!isStudent && data.bySection.length > 0) {
    doc.drawSubheading('1.6 Comparativa por secciones', 'Mapa grado × sección · número de incidencias');
    const grid = sectionGrid(data.bySection, (r) => r.totalIncidents, (r) => (r.totalIncidents > 0 ? `${r.studentsWithIncidents} est.` : null));
    doc.drawChartImage(heatmapChart(grid.rows, grid.sections, { ramp: BLUE_RAMP, legend: ['Menos', 'Más incidencias'] }));
    if (insights.incidents.topSection) {
      const ranked = [...data.bySection].sort((a, b) => b.totalIncidents - a.totalIncidents);
      const top3Sum = ranked.slice(0, 3).reduce((s, r) => s + r.totalIncidents, 0);
      const secTotal = ranked.reduce((s, r) => s + r.totalIncidents, 0);
      doc.drawInsight(
        `${insights.incidents.topSection.label.replace(' • ', ' ')} es la sección con más incidencias (${insights.incidents.topSection.totalIncidents}). ` +
          `Las tres secciones con más reúnen el ${pct(top3Sum, secTotal, 0)} del total.`,
      );
    }
    doc.drawTable(
      [
        { header: '#', dataKey: 'rank', width: 10, align: 'center' },
        { header: 'Sección', dataKey: 'label' },
        { header: 'Incidencias', dataKey: 'total', width: 24, align: 'right' },
        { header: 'Estudiantes', dataKey: 'students', width: 24, align: 'right' },
        { header: 'Nivel prom.', dataKey: 'avg', width: 24, align: 'right' },
        { header: '% del total', dataKey: 'pct', width: 22, align: 'right' },
      ],
      [...data.bySection]
        .sort((a, b) => b.totalIncidents - a.totalIncidents)
        .map((s, i) => ({
          rank: i + 1,
          label: s.label.replace(' • ', ' '),
          total: s.totalIncidents,
          students: s.studentsWithIncidents,
          avg: s.averageReincidence.toFixed(2),
          pct: pct(s.totalIncidents, total),
        })),
      { fontSize: 7.5 },
    );
  }

  // ── 2. Tardanzas
  const lateness = data.lateness;
  if (!isStudent && lateness && insights.lateness) {
    doc.addPage();
    doc.drawSectionTitle('2. Tardanzas');
    doc.drawParagraph(
      `${lateness.totalLate} tardanzas de ${lateness.studentsLate} estudiantes` +
        (lateness.arrivalsTotal != null ? ` sobre ${lateness.arrivalsTotal.toLocaleString('es-PE')} llegadas registradas` : '') +
        `. Retraso promedio: ${minutes(lateness.avgMinutesLate)}. Justificadas: ${lateness.justified}.`,
      9,
    );

    doc.drawSubheading('2.1 Mapa por grado y sección', 'Número de tardanzas · % del aula que llegó tarde');
    const grid = sectionGrid(
      lateness.classrooms,
      (c) => c.lateCount,
      (c) => (c.lateCount > 0 && c.studentRate != null ? `${Math.round(c.studentRate * 100)}% aula` : null),
    );
    doc.drawChartImage(heatmapChart(grid.rows, grid.sections, { ramp: ORANGE_RAMP, legend: ['Menos', 'Más tardanzas'] }));
    if (insights.lateness.topClassroom) {
      const c = insights.lateness.topClassroom;
      doc.drawInsight(
        `${c.label} es el aula con más tardanzas (${c.lateCount})` +
          (c.studentRate != null ? `: ${c.studentsLate} de sus ${c.enrolled} estudiantes llegaron tarde al menos una vez (${pct(c.studentRate, 1, 0)}).` : '.'),
      );
    }

    const rankedRooms = [...lateness.classrooms].filter((c) => c.lateCount > 0).sort((a, b) => b.lateCount - a.lateCount);
    if (rankedRooms.length > 0) {
      doc.drawSubheading('2.2 Aulas con más tardanzas');
      doc.drawChartImage(
        horizontalBarChart(
          rankedRooms.slice(0, 10).map((c) => ({ label: c.label, value: c.lateCount, note: c.studentRate != null ? `${Math.round(c.studentRate * 100)}% del aula` : undefined })),
          { color: CHART_COLORS.orange, softColor: CHART_COLORS.orangeSoft, strongTop: 3, labelWidth: 110 },
        ),
        doc.contentWidth * 0.9,
      );
    }

    if (insights.lateness.months.length > 0) {
      doc.drawSubheading('2.3 Tardanzas por mes');
      doc.drawChartImage(
        verticalBarChart(
          insights.lateness.months.map((m) => ({ label: m.label.slice(0, 3), value: m.lateCount })),
          { color: CHART_COLORS.orange, softColor: CHART_COLORS.orangeSoft, highlightMax: true, height: 200 },
        ),
        doc.contentWidth * 0.8,
      );
      if (insights.lateness.peakMonth) {
        doc.drawInsight(`${insights.lateness.peakMonth.label[0].toUpperCase()}${insights.lateness.peakMonth.label.slice(1)} fue el mes con más tardanzas (${insights.lateness.peakMonth.lateCount}).`);
      }
    }

    if (lateness.totalLate > 0) {
      doc.drawSubheading('2.4 Justificación y minutos de retraso');
      doc.drawChartRow([
        donutChart(
          [
            { label: 'Sin justificar', value: lateness.totalLate - lateness.justified, color: CHART_COLORS.orange },
            { label: 'Justificadas', value: lateness.justified, color: CHART_COLORS.blue },
          ],
          { centerLabel: 'tardanzas' },
        ),
        donutChart(
          lateness.byDelay.map((b, i) => ({ label: b.label, value: b.value, color: LATE_DELAY_COLORS[i] })),
          { centerLabel: 'con hora' },
        ),
      ]);
    }

    if (lateness.students.length > 0) {
      doc.drawSubheading('2.5 Estudiantes con tardanzas', `${lateness.students.length} estudiantes · de más a menos`);
      doc.drawTable(
        [
          { header: '#', dataKey: 'rank', width: 9, align: 'center' },
          { header: 'Estudiante', dataKey: 'name' },
          { header: 'Aula', dataKey: 'room', width: 24 },
          { header: 'Tard.', dataKey: 'n', width: 13, align: 'right' },
          { header: 'Justif.', dataKey: 'j', width: 14, align: 'right' },
          { header: 'Retraso prom.', dataKey: 'avg', width: 24, align: 'right' },
          { header: 'Última', dataKey: 'last', width: 28, align: 'right' },
        ],
        lateness.students.map((s, i) => ({
          rank: i + 1,
          name: s.studentName,
          room: s.classroomLabel,
          n: s.lateCount,
          j: s.justifiedCount,
          avg: minutes(s.avgMinutesLate),
          last: `${format(new Date(`${s.lastDate}T12:00:00`), 'dd/MM/yyyy')} ${s.lastTime}`,
        })),
        { fontSize: 7.5 },
      );
    }
  }

  // ── Anexo
  if (incidents.length > 0) {
    doc.addPage();
    doc.drawSectionTitle(isStudent ? 'Anexo. Detalle de incidencias' : 'Anexo. Detalle de incidencias');
    doc.drawParagraph(`${incidents.length} registros, del más reciente al más antiguo.`, 8.5);
    doc.drawTable(
      [
        { header: 'Fecha', dataKey: 'date', width: 25 },
        { header: 'Estudiante', dataKey: 'student', width: 48 },
        { header: 'Aula', dataKey: 'grade', width: 18 },
        { header: 'Falta', dataKey: 'fault' },
        { header: 'Niv.', dataKey: 'level', width: 10, align: 'center' },
        { header: 'Estado', dataKey: 'status', width: 22 },
      ],
      [...incidents]
        .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
        .map((inc) => ({
          date: format(new Date(inc.registeredAt), 'dd/MM/yyyy HH:mm', { locale: es }),
          student: inc.student?.fullName ?? '—',
          grade: inc.student ? `${inc.student.grade} ${inc.student.section}` : '—',
          fault: inc.faultType?.name ?? '—',
          level: String(inc.reincidenceLevel),
          status: inc.status,
        })),
      { fontSize: 7 },
    );
  }

  const name = isStudent
    ? `Informe_${data.studentName!.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`
    : `Informe_Convivencia_Puntualidad_${format(new Date(), 'yyyy_MM_dd')}.pdf`;
  await doc.finalize(name);
}
