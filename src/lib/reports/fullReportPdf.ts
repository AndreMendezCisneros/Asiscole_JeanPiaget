import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Incident, ReincidenceLevel } from '@/types';
import { getReincidenceLevelBarColor, getReincidenceLevelSummaryLabel } from '@/lib/utils/reincidenceUtils';
import { buildReportInsights, type ReportExportData } from './reportInsights';
import { InstitutionalPdf } from './institutionalPdf';
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

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Filas grado × sección para los mapas de calor. */
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
 * Informe institucional en PDF: portada con ficha técnica e índice, cifras clave,
 * resumen ejecutivo, incidencias y tardanzas con figuras y tablas numeradas, anexo y firmas.
 */
export async function exportFullReportPdf(data: ReportExportData, incidents: Incident[]): Promise<void> {
  const insights = buildReportInsights(data);
  const { stats } = data;
  const total = stats.totalIncidents;
  const isStudent = Boolean(data.studentName);
  const issued = format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  const source = 'SIE Asiscole, registros de incidencias y de llegadas';

  const doc = new InstitutionalPdf(
    data.schoolName,
    isStudent ? 'Informe de convivencia del estudiante' : 'Informe de convivencia y puntualidad',
    source,
  );

  await doc.cover({
    subtitle: data.periodLabel,
    facts: [
      ['Institución', data.schoolName],
      ['Período', data.periodLabel],
      ['Alcance', data.studentName ? `Estudiante: ${data.studentName}` : data.filterText || 'Todos los niveles, grados y secciones'],
      ['Emisión', issued],
      ['Fuente de datos', 'Registro de incidencias de convivencia y control de llegadas del SIE. Las cifras respetan los filtros elegidos en Reportes.'],
    ],
    withToc: true,
  });

  // ── Página 2: síntesis
  doc.newPage();
  doc.section('', 'Síntesis');
  const figures: { label: string; value: string | number; note?: string; tone?: 'accent' | 'warn' }[] = [
    { label: 'Incidencias', value: total, note: isStudent ? undefined : `${stats.studentsWithIncidents} estudiantes involucrados` },
    { label: 'Nivel promedio', value: stats.averageReincidenceLevel.toFixed(1), note: 'escala de 0 a 5' },
    { label: 'Casos críticos', value: insights.incidents.critical, note: `${pct(insights.incidents.critical, total, 0)} del total · nivel 3 o más` },
    {
      label: 'Mes con más incidencias',
      value: insights.incidents.peakMonth?.month ?? '—',
      note: insights.incidents.peakMonth ? `${insights.incidents.peakMonth.incidents} incidencias` : undefined,
    },
  ];
  if (insights.lateness) {
    const l = insights.lateness;
    figures.push(
      { label: 'Tardanzas', value: l.total, note: `${l.students} estudiantes`, tone: 'warn' },
      { label: 'Llegadas tarde', value: l.rate == null ? '—' : pct(l.rate, 1), note: 'del total de llegadas', tone: 'warn' },
      { label: 'Retraso promedio', value: minutes(l.avgMinutes), note: 'por tardanza', tone: 'warn' },
      {
        label: 'Aula con más tardanzas',
        value: l.topClassroom?.label ?? '—',
        note: l.topClassroom ? `${l.topClassroom.lateCount} tardanzas` : undefined,
        tone: 'warn',
      },
    );
  }
  doc.keyFigures(figures);
  doc.y += 2;
  doc.subsection('', 'Resumen ejecutivo', 30);
  doc.numbered(insights.summary);
  doc.attention('Puntos de atención', insights.alerts);

  // ── 1. Incidencias
  doc.newPage();
  doc.section('1', 'Incidencias de convivencia');
  let n = 0;
  const sub = (title: string, keep = 75) => doc.subsection(`1.${++n}`, title, keep);

  if (data.monthlyTrend.length > 0) {
    sub('Evolución mensual');
    doc.chart(
      areaTrendChart(data.monthlyTrend.map((m) => ({ label: m.month, value: m.incidents }))),
      `Incidencias registradas por mes. La línea punteada marca el promedio mensual.`,
    );
    const { peakMonth, average, lastVsPrevious } = insights.incidents;
    if (peakMonth) {
      doc.reading(
        `${peakMonth.month} concentró el mayor número de incidencias (${peakMonth.incidents}), ${(peakMonth.incidents / Math.max(average, 1)).toFixed(1)} veces el promedio de ${average.toFixed(1)} por mes.` +
          (lastVsPrevious && lastVsPrevious.change != null && lastVsPrevious.change !== 0
            ? ` En ${lastVsPrevious.last} las incidencias ${lastVsPrevious.change > 0 ? 'aumentaron' : 'disminuyeron'} ${pct(Math.abs(lastVsPrevious.change), 1, 0)} respecto al mes anterior (de ${lastVsPrevious.previous} a ${lastVsPrevious.current}).`
            : ''),
      );
    }
    doc.dataTable(
      'Incidencias por mes y variación.',
      [
        { header: 'Mes', key: 'month' },
        { header: 'Incidencias', key: 'n', align: 'right', width: 28 },
        { header: 'Diferencia con el promedio', key: 'vs', align: 'right', width: 46 },
        { header: 'Variación mensual', key: 'var', align: 'right', width: 34 },
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
    );
  }

  if (!isStudent && data.weeklyData.some((d) => d.count > 0)) {
    sub('Distribución por día de la semana', 60);
    doc.chart(
      verticalBarChart(data.weeklyData.map((d) => ({ label: d.day, value: d.count })), { highlightMax: true, height: 200 }),
      'Incidencias de la semana en curso por día. Se resalta el día con más registros.',
      doc.CW * 0.78,
    );
    const pk = insights.incidents.peakWeekday;
    const wTotal = data.weeklyData.reduce((s, d) => s + d.count, 0);
    if (pk) doc.reading(`${pk.day} reúne ${pct(pk.count, wTotal, 0)} de las incidencias de la semana (${pk.count} de ${wTotal}).`);
  }

  sub('Gravedad según nivel de reincidencia', 60);
  const levelRows = LEVEL_KEYS.map((k, i) => ({
    level: i,
    label: `Nivel ${i} · ${getReincidenceLevelSummaryLabel(i as ReincidenceLevel)}`,
    value: stats.levelDistribution[k] ?? 0,
  })).filter((r) => r.level < 5 || r.value > 0);
  doc.chart(
    donutChart(
      levelRows.map((r) => ({ label: r.label, value: r.value, color: getReincidenceLevelBarColor(r.level) })),
      { width: 520, height: 200, centerLabel: 'incidencias' },
    ),
    'Incidencias según el nivel de reincidencia del estudiante al momento del registro.',
    doc.CW * 0.72,
  );
  doc.reading(
    insights.incidents.critical > 0
      ? `${insights.incidents.critical} incidencias (${pct(insights.incidents.critical, total, 0)}) corresponden a estudiantes en nivel 3 o más. Son los casos que requieren seguimiento de tutoría y coordinación.`
      : 'Ninguna incidencia del período corresponde a nivel 3 o más.',
  );

  if (stats.topFaults.length > 0) {
    sub('Faltas más frecuentes');
    doc.chart(
      horizontalBarChart(
        stats.topFaults.slice(0, 10).map((f) => ({ label: f.faultType, value: f.count })),
        { strongTop: 3, valueFormatter: (v) => `${v} · ${pct(v, total, 0)}` },
      ),
      'Tipos de falta con más registros y su porcentaje del total. Se resaltan las tres primeras.',
    );
    if (stats.topFaults.length >= 3) {
      doc.reading(
        `Las tres faltas más comunes suman el ${pct(insights.incidents.top3Share, 1, 0)} de las incidencias; actuar sobre ellas es lo que más reduce el total.`,
      );
    }
    let acc = 0;
    doc.dataTable(
      'Faltas por frecuencia, con porcentaje y acumulado.',
      [
        { header: 'N.°', key: 'rank', width: 12, align: 'center' },
        { header: 'Tipo de falta', key: 'fault' },
        { header: 'Cantidad', key: 'count', width: 22, align: 'right' },
        { header: '% del total', key: 'pct', width: 24, align: 'right' },
        { header: '% acumulado', key: 'acc', width: 26, align: 'right' },
      ],
      stats.topFaults.map((f, i) => {
        acc += f.count;
        return { rank: i + 1, fault: f.faultType, count: f.count, pct: pct(f.count, total), acc: pct(acc, total, 0) };
      }),
    );
  }

  if (!isStudent && data.byGrade.length > 0) {
    sub('Comparación por grados');
    const multi = new Set(data.byGrade.map((g) => g.level)).size > 1;
    doc.chart(
      stackedBarChart(
        data.byGrade.map((g) => (multi ? `${LEVEL_SHORT[g.level] ?? g.level} ${g.grade}` : g.grade)),
        (['level0', 'level1', 'level2', 'level3', 'level4'] as const).map((k, i) => ({
          label: `Nivel ${i}`,
          color: getReincidenceLevelBarColor(i),
          values: data.byGrade.map((g) => g.levelDistribution[k]),
        })),
      ),
      'Incidencias por grado, divididas según el nivel de reincidencia.',
    );
    if (insights.incidents.topGrade) {
      const worstRatio = [...data.byGrade]
        .filter((g) => g.studentsWithIncidents > 0)
        .sort((a, b) => b.totalIncidents / b.studentsWithIncidents - a.totalIncidents / a.studentsWithIncidents)[0];
      doc.reading(
        `${insights.incidents.topGrade.label} registra más incidencias (${insights.incidents.topGrade.totalIncidents}, ${pct(insights.incidents.topGrade.totalIncidents, total, 0)} del total).` +
          (worstRatio
            ? ` En ${worstRatio.label} cada estudiante involucrado acumula ${(worstRatio.totalIncidents / worstRatio.studentsWithIncidents).toFixed(1)} incidencias en promedio, lo que indica casos repetidos.`
            : ''),
      );
    }
    doc.dataTable(
      'Incidencias por grado y nivel de reincidencia.',
      [
        { header: 'Grado', key: 'label' },
        { header: 'Incid.', key: 'total', width: 14, align: 'right' },
        { header: 'Estud.', key: 'students', width: 14, align: 'right' },
        { header: 'Por estud.', key: 'ratio', width: 18, align: 'right' },
        { header: 'Niv. prom.', key: 'avg', width: 18, align: 'right' },
        { header: 'N0', key: 'l0', width: 10, align: 'right' },
        { header: 'N1', key: 'l1', width: 10, align: 'right' },
        { header: 'N2', key: 'l2', width: 10, align: 'right' },
        { header: 'N3', key: 'l3', width: 10, align: 'right' },
        { header: 'N4', key: 'l4', width: 10, align: 'right' },
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
    sub('Comparación por secciones', 90);
    const grid = sectionGrid(data.bySection, (r) => r.totalIncidents, (r) => (r.totalIncidents > 0 ? `${r.studentsWithIncidents} est.` : null));
    doc.chart(
      heatmapChart(grid.rows, grid.sections, { ramp: BLUE_RAMP, legend: ['Menos', 'Más incidencias'] }),
      'Incidencias por grado y sección; debajo de cada cifra, estudiantes involucrados.',
    );
    const ranked = [...data.bySection].sort((a, b) => b.totalIncidents - a.totalIncidents);
    if (insights.incidents.topSection) {
      const top3Sum = ranked.slice(0, 3).reduce((s, r) => s + r.totalIncidents, 0);
      const secTotal = ranked.reduce((s, r) => s + r.totalIncidents, 0);
      doc.reading(
        `${insights.incidents.topSection.label.replace(' • ', ' ')} es la sección con más incidencias (${insights.incidents.topSection.totalIncidents}); las tres secciones con más reúnen el ${pct(top3Sum, secTotal, 0)} del total.`,
      );
    }
    doc.dataTable(
      'Secciones ordenadas por número de incidencias.',
      [
        { header: 'N.°', key: 'rank', width: 12, align: 'center' },
        { header: 'Sección', key: 'label' },
        { header: 'Incidencias', key: 'total', width: 24, align: 'right' },
        { header: 'Estudiantes', key: 'students', width: 24, align: 'right' },
        { header: 'Nivel prom.', key: 'avg', width: 22, align: 'right' },
        { header: '% del total', key: 'pct', width: 22, align: 'right' },
      ],
      ranked.map((s, i) => ({
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
    doc.newPage();
    doc.section('2', 'Puntualidad y tardanzas', 'warn');
    doc.paragraph(
      `En el período se registraron ${lateness.totalLate} tardanzas de ${lateness.studentsLate} estudiantes` +
        (lateness.arrivalsTotal != null ? `, sobre ${lateness.arrivalsTotal.toLocaleString('es-PE')} llegadas registradas` : '') +
        `. El retraso promedio fue de ${minutes(lateness.avgMinutesLate)} y ${lateness.justified} tardanzas fueron justificadas.`,
    );
    doc.y += 2;
    let m = 0;
    const lsub = (title: string, keep = 75) => doc.subsection(`2.${++m}`, title, keep);

    lsub('Tardanzas por grado y sección', 90);
    const grid = sectionGrid(
      lateness.classrooms,
      (c) => c.lateCount,
      (c) => (c.lateCount > 0 && c.studentRate != null ? `${Math.round(c.studentRate * 100)}% aula` : null),
    );
    doc.chart(
      heatmapChart(grid.rows, grid.sections, { ramp: ORANGE_RAMP, legend: ['Menos', 'Más tardanzas'] }),
      'Tardanzas por aula; debajo, el porcentaje de sus estudiantes que llegó tarde al menos una vez.',
    );
    if (insights.lateness.topClassroom) {
      const c = insights.lateness.topClassroom;
      doc.reading(
        `${c.label} es el aula con más tardanzas (${c.lateCount})` +
          (c.studentRate != null ? `: ${c.studentsLate} de sus ${c.enrolled} estudiantes llegaron tarde al menos una vez (${pct(c.studentRate, 1, 0)}).` : '.'),
      );
    }

    const rankedRooms = [...lateness.classrooms].filter((c) => c.lateCount > 0).sort((a, b) => b.lateCount - a.lateCount);
    if (rankedRooms.length > 0) {
      lsub('Aulas con más tardanzas');
      doc.chart(
        horizontalBarChart(
          rankedRooms.slice(0, 10).map((c) => ({
            label: c.label,
            value: c.lateCount,
            note: c.studentRate != null ? `${Math.round(c.studentRate * 100)}% del aula` : undefined,
          })),
          { color: CHART_COLORS.orange, softColor: CHART_COLORS.orangeSoft, strongTop: 3, labelWidth: 110 },
        ),
        'Las diez aulas con más tardanzas en el período.',
        doc.CW * 0.92,
      );
      doc.dataTable(
        'Tardanzas por aula.',
        [
          { header: 'Aula', key: 'room' },
          { header: 'Estud. activos', key: 'enr', width: 26, align: 'right' },
          { header: 'Con tardanza', key: 'sl', width: 26, align: 'right' },
          { header: '% del aula', key: 'rate', width: 22, align: 'right' },
          { header: 'Tardanzas', key: 'n', width: 22, align: 'right' },
        ],
        rankedRooms.map((c) => ({
          room: c.label,
          enr: c.enrolled || '—',
          sl: c.studentsLate,
          rate: c.studentRate == null ? '—' : pct(c.studentRate, 1, 0),
          n: c.lateCount,
        })),
        { fontSize: 7.5 },
      );
    }

    if (insights.lateness.months.length > 0) {
      lsub('Tardanzas por mes', 60);
      doc.chart(
        verticalBarChart(
          insights.lateness.months.map((mm) => ({ label: capitalize(mm.label.slice(0, 3)), value: mm.lateCount })),
          { color: CHART_COLORS.orange, softColor: CHART_COLORS.orangeSoft, highlightMax: true, height: 200 },
        ),
        'Tardanzas registradas por mes. Se resalta el mes con más.',
        doc.CW * 0.78,
      );
      if (insights.lateness.peakMonth) {
        doc.reading(`${capitalize(insights.lateness.peakMonth.label)} fue el mes con más tardanzas (${insights.lateness.peakMonth.lateCount}).`);
      }
    }

    if (lateness.totalLate > 0) {
      lsub('Justificación y minutos de retraso', 55);
      doc.chartPair(
        [
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
        ],
        'Izquierda: tardanzas justificadas y sin justificar. Derecha: minutos de retraso respecto a la hora límite.',
      );
    }

    if (lateness.students.length > 0) {
      lsub('Estudiantes con tardanzas', 40);
      doc.dataTable(
        `Estudiantes con tardanzas, de más a menos (${lateness.students.length}).`,
        [
          { header: 'N.°', key: 'rank', width: 10, align: 'center' },
          { header: 'Estudiante', key: 'name' },
          { header: 'Aula', key: 'room', width: 24 },
          { header: 'Tard.', key: 'n', width: 13, align: 'right' },
          { header: 'Justif.', key: 'j', width: 14, align: 'right' },
          { header: 'Retraso prom.', key: 'avg', width: 24, align: 'right' },
          { header: 'Última', key: 'last', width: 28, align: 'right' },
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
    doc.newPage();
    doc.section('A', 'Anexo. Detalle de incidencias');
    doc.dataTable(
      `Incidencias del período, de la más reciente a la más antigua (${incidents.length}).`,
      [
        { header: 'Fecha', key: 'date', width: 26 },
        { header: 'Estudiante', key: 'student', width: 50 },
        { header: 'Aula', key: 'grade', width: 16 },
        { header: 'Falta', key: 'fault' },
        { header: 'Niv.', key: 'level', width: 10, align: 'center' },
        { header: 'Estado', key: 'status', width: 22 },
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

  doc.signatures(['Elaborado por', 'Coordinación de Tutoría y Convivencia', 'Dirección']);

  const name = isStudent
    ? `Informe_${data.studentName!.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`
    : `Informe_Convivencia_Puntualidad_${format(new Date(), 'yyyy_MM_dd')}.pdf`;
  doc.save(name, issued);
}
