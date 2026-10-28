// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- los tipos de exceljs no resuelven en este proyecto (igual que excelExport.ts)
// @ts-nocheck
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type ExcelJS from 'exceljs';
import type { Incident, ReincidenceLevel } from '@/types';
import {
  addBrandedExcelHeader,
  createWorkbook,
  EXCEL_COLORS,
  freezePane,
  runExcelExport,
  setColumnWidths,
  styleDataRows,
  styleHeaderRow,
} from '@/lib/utils/excelExport';
import { getReincidenceLevelBarColor, getReincidenceLevelSummaryLabel } from '@/lib/utils/reincidenceUtils';
import { buildReportInsights, type ReportExportData } from './reportInsights';
import { injectCharts, rangeRef, type ChartKind, type ChartSpec } from './excelCharts';

const BLUE = 'FF2F63B8';
const ORANGE = 'FFD4501F';
const PALE = 'FFF5F7FA';
const HEX_BLUE = '2F63B8';
const HEX_ORANGE = 'D4501F';
const LEVEL_SHORT: Record<string, string> = { Primaria: 'Prim.', Secundaria: 'Sec.', Inicial: 'Inic.' };

/** 'hsl(152, 55%, 45%)' → '33B07A' (los gráficos de Excel piden hex). */
function hslToHex(hsl: string): string {
  const m = /hsl\(\s*([\d.]+)[ ,]+([\d.]+)%[ ,]+([\d.]+)%/.exec(hsl);
  if (!m) return '64748B';
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const LEVEL_HEX = [0, 1, 2, 3, 4, 5].map((l) => hslToHex(getReincidenceLevelBarColor(l)));

type Col = {
  header: string;
  width: number;
  /** Formato de número de Excel: '0', '0.0', '0.0%', 'dd/mm/yyyy'. */
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
  /** Barra de datos en esta columna. */
  bar?: 'blue' | 'orange';
  /** Escala de color en esta columna. */
  scale?: 'blue' | 'orange';
};

/** Ubicación de una tabla escrita: filas de datos y columnas (base 1). */
type TablePos = { sheet: string; first: number; last: number };

/** Tabla con cabecera de marca, cebra, formatos, filtro, barras de datos y escala de color. */
function writeTable(sheet: ExcelJS.Worksheet, startRow: number, cols: Col[], rows: unknown[][]): TablePos {
  const header = sheet.getRow(startRow);
  cols.forEach((c, i) => (header.getCell(i + 1).value = c.header));
  styleHeaderRow(header);
  rows.forEach((r, i) => {
    const row = sheet.getRow(startRow + 1 + i);
    r.forEach((v, j) => (row.getCell(j + 1).value = v));
  });
  const last = startRow + rows.length;
  if (rows.length > 0) {
    styleDataRows(sheet, startRow + 1, last, { zebra: true });
    cols.forEach((c, j) => {
      for (let r = startRow + 1; r <= last; r++) {
        const cell = sheet.getRow(r).getCell(j + 1);
        if (c.numFmt) cell.numFmt = c.numFmt;
        cell.alignment = { vertical: 'middle', horizontal: c.align ?? (c.numFmt ? 'right' : 'left'), wrapText: !c.numFmt };
      }
      const letter = sheet.getColumn(j + 1).letter;
      const ref = `${letter}${startRow + 1}:${letter}${last}`;
      if (c.bar) {
        sheet.addConditionalFormatting({
          ref,
          rules: [
            {
              type: 'dataBar',
              priority: 1,
              gradient: false,
              minLength: 0,
              maxLength: 100,
              cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
              color: { argb: c.bar === 'orange' ? ORANGE : BLUE },
            },
          ],
        });
      }
      if (c.scale) {
        sheet.addConditionalFormatting({
          ref,
          rules: [
            {
              type: 'colorScale',
              priority: 2,
              cfvo: [{ type: 'min' }, { type: 'max' }],
              color: [{ argb: PALE }, { argb: c.scale === 'orange' ? 'FFF39A73' : 'FF8EB1E8' }],
            },
          ],
        });
      }
      sheet.getColumn(j + 1).width = c.width;
    });
    sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: last, column: cols.length } };
  }
  freezePane(sheet, startRow);
  return { sheet: sheet.name, first: startRow + 1, last };
}

async function newSheet(workbook: ExcelJS.Workbook, name: string, title: string, subtitle: string, cols: number, tab: string) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: tab } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const row = await addBrandedExcelHeader(workbook, sheet, title, subtitle, Math.max(cols, 4));
  return { sheet, row };
}

function writeNote(sheet: ExcelJS.Worksheet, row: number, text: string, cols: number, tone: 'info' | 'warn' = 'info'): number {
  const cell = sheet.getRow(row).getCell(1);
  cell.value = text;
  cell.font = { size: 10, color: { argb: 'FF0F172A' } };
  cell.alignment = { wrapText: true, vertical: 'top' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone === 'warn' ? 'FFFEF3C7' : 'FFEFF6FF' } };
  cell.border = { left: { style: 'thick', color: { argb: tone === 'warn' ? 'FFB45F06' : BLUE } } };
  sheet.mergeCells(row, 1, row, cols);
  sheet.getRow(row).height = Math.max(20, Math.ceil(text.length / (cols * 11)) * 15 + 6);
  return row + 1;
}

function sectionTitle(sheet: ExcelJS.Worksheet, row: number, text: string, cols: number): number {
  const cell = sheet.getRow(row).getCell(1);
  cell.value = text;
  cell.font = { size: 12, bold: true, color: { argb: EXCEL_COLORS.headerBg } };
  cell.border = { bottom: { style: 'medium', color: { argb: EXCEL_COLORS.headerBg } } };
  sheet.mergeCells(row, 1, row, cols);
  sheet.getRow(row).height = 22;
  return row + 2;
}

/** Gráfico a partir de columnas de una tabla escrita (categoría + una o varias series). */
function chartFrom(
  pos: TablePos,
  opts: {
    kind: ChartKind;
    title: string;
    catCol: number;
    cats: string[];
    series: { name: string; col: number; values: number[]; color: string; pointColors?: string[] }[];
    /** Solo las primeras N filas (p. ej. top 15). */
    limit?: number;
    showValues?: boolean;
  },
): Omit<ChartSpec, 'sheet' | 'col' | 'row' | 'widthPx' | 'heightPx'> {
  const n = Math.min(opts.cats.length, opts.limit ?? opts.cats.length);
  const lastRow = pos.first + n - 1;
  return {
    kind: opts.kind,
    title: opts.title,
    showValues: opts.showValues ?? true,
    categories: { ref: rangeRef(pos.sheet, opts.catCol, pos.first, lastRow), values: opts.cats.slice(0, n) },
    series: opts.series.map((s) => ({
      name: s.name,
      ref: rangeRef(pos.sheet, s.col, pos.first, lastRow),
      values: s.values.slice(0, n),
      color: s.color,
      pointColors: s.pointColors?.slice(0, n),
    })),
  };
}

/**
 * Libro de Excel del informe con gráficos nativos (se actualizan al editar las celdas):
 * «Resumen» con cifras, resumen ejecutivo y todos los gráficos; una hoja por análisis
 * con su tabla y su gráfico; detalle completo de incidencias.
 */
export async function exportFullReportExcel(data: ReportExportData, incidents: Incident[]): Promise<void> {
  await runExcelExport('informe en Excel', async () => {
    const insights = buildReportInsights(data);
    const { stats } = data;
    const total = stats.totalIncidents;
    const isStudent = Boolean(data.studentName);
    const scope = data.studentName ? `Estudiante: ${data.studentName}` : data.filterText || 'Todos los niveles, grados y secciones';
    const subtitle = `${data.schoolName} · ${data.periodLabel} · ${scope}`;
    const workbook = createWorkbook('Informe de convivencia y puntualidad');
    const charts: ChartSpec[] = [];
    /** Gráficos que también van en «Resumen». */
    const summaryCharts: Omit<ChartSpec, 'sheet' | 'col' | 'row' | 'widthPx' | 'heightPx'>[] = [];
    /** Gráfico al lado derecho de la tabla, y copia para el Resumen. */
    const place = (
      sheet: ExcelJS.Worksheet,
      tableCols: number,
      startRow: number,
      spec: Omit<ChartSpec, 'sheet' | 'col' | 'row' | 'widthPx' | 'heightPx'>,
      size: [number, number] = [620, 340],
    ) => {
      charts.push({ ...spec, sheet: sheet.name, col: tableCols + 1, row: startRow - 1, widthPx: size[0], heightPx: size[1] });
      summaryCharts.push(spec);
    };

    // ── Resumen (los gráficos se agregan al final, cuando ya se conocen los rangos)
    const COLS = 8;
    const { sheet: summary, row: r0 } = await newSheet(
      workbook,
      'Resumen',
      isStudent ? 'INFORME DE CONVIVENCIA DEL ESTUDIANTE' : 'INFORME DE CONVIVENCIA Y PUNTUALIDAD',
      subtitle,
      COLS,
      BLUE,
    );
    setColumnWidths(summary, [28, 16, 3, 28, 16, 3, 14, 14]);
    let row = r0;
    summary.getRow(row).getCell(1).value = `Emitido el ${format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}. Las cifras respetan los filtros de Reportes. Los gráficos se actualizan si cambia los valores de las hojas.`;
    summary.getRow(row).getCell(1).font = { size: 9, italic: true, color: { argb: EXCEL_COLORS.subtitle } };
    summary.mergeCells(row, 1, row, COLS);
    row += 2;

    row = sectionTitle(summary, row, 'Cifras clave', COLS);
    const kpis: [string, string | number, string, string | number][] = [
      ['Incidencias', total, 'Tardanzas', insights.lateness?.total ?? '—'],
      [isStudent ? 'Nivel promedio' : 'Estudiantes con incidencias', isStudent ? Number(stats.averageReincidenceLevel.toFixed(1)) : stats.studentsWithIncidents, 'Estudiantes con tardanza', insights.lateness?.students ?? '—'],
      ['Casos críticos (nivel 3+)', insights.incidents.critical, '% de llegadas tarde', insights.lateness?.rate ?? '—'],
      ['Mes con más incidencias', insights.incidents.peakMonth ? `${insights.incidents.peakMonth.month} (${insights.incidents.peakMonth.incidents})` : '—', 'Aula con más tardanzas', insights.lateness?.topClassroom ? `${insights.lateness.topClassroom.label} (${insights.lateness.topClassroom.lateCount})` : '—'],
      ['Falta más frecuente', insights.incidents.topFault ? `${insights.incidents.topFault.faultType} (${insights.incidents.topFault.count})` : '—', 'Mes con más tardanzas', insights.lateness?.peakMonth ? `${insights.lateness.peakMonth.label} (${insights.lateness.peakMonth.lateCount})` : '—'],
    ];
    for (const [l1, v1, l2, v2] of kpis) {
      const rr = summary.getRow(row);
      rr.height = 22;
      const put = (col: number, label: string, value: string | number, accent: string) => {
        const lc = rr.getCell(col);
        lc.value = label;
        lc.font = { size: 10, color: { argb: EXCEL_COLORS.subtitle } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
        lc.border = { left: { style: 'thick', color: { argb: accent } } };
        lc.alignment = { vertical: 'middle' };
        const vc = rr.getCell(col + 1);
        vc.value = value;
        vc.font = { size: 12, bold: true, color: { argb: 'FF0F172A' } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE } };
        vc.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof value === 'number' && label.startsWith('%')) vc.numFmt = '0.0%';
      };
      put(1, l1, v1, BLUE);
      if (!isStudent) put(4, l2, v2, ORANGE);
      row += 1;
    }
    row += 1;

    row = sectionTitle(summary, row, 'Resumen ejecutivo', COLS);
    insights.summary.forEach((s, i) => (row = writeNote(summary, row, `${i + 1}.  ${s}`, COLS)));
    row += 1;
    if (insights.alerts.length > 0) {
      row = sectionTitle(summary, row, 'Puntos de atención', COLS);
      insights.alerts.forEach((a) => (row = writeNote(summary, row, a, COLS, 'warn')));
      row += 1;
    }
    row = sectionTitle(summary, row, 'Gráficos', COLS);
    const chartsStartRow = row;

    // ── Mensual
    if (data.monthlyTrend.length > 0) {
      const { sheet, row: start } = await newSheet(workbook, 'Mensual', 'INCIDENCIAS POR MES', subtitle, 4, BLUE);
      const avg = insights.incidents.average;
      const pos = writeTable(
        sheet,
        start,
        [
          { header: 'Mes', width: 14 },
          { header: 'Incidencias', width: 14, numFmt: '0', bar: 'blue' },
          { header: 'Frente al promedio', width: 18, numFmt: '+0.0;-0.0;0.0' },
          { header: 'Variación mensual', width: 18, numFmt: '+0%;-0%;0%' },
        ],
        data.monthlyTrend.map((m, i) => {
          const prev = i > 0 ? data.monthlyTrend[i - 1].incidents : null;
          return [m.month, m.incidents, m.incidents - avg, prev ? (m.incidents - prev) / prev : null];
        }),
      );
      writeNote(sheet, pos.last + 2, `Promedio mensual: ${avg.toFixed(1)}. Mes pico: ${insights.incidents.peakMonth ? `${insights.incidents.peakMonth.month} (${insights.incidents.peakMonth.incidents})` : '—'}.`, 4);
      place(
        sheet,
        4,
        start,
        chartFrom(pos, {
          kind: 'line',
          title: 'Incidencias por mes',
          catCol: 1,
          cats: data.monthlyTrend.map((m) => m.month),
          series: [{ name: 'Incidencias', col: 2, values: data.monthlyTrend.map((m) => m.incidents), color: HEX_BLUE }],
        }),
      );
    }

    // ── Faltas
    if (stats.topFaults.length > 0) {
      const { sheet, row: start } = await newSheet(workbook, 'Faltas', 'FALTAS MÁS FRECUENTES', subtitle, 5, BLUE);
      let acc = 0;
      const pos = writeTable(
        sheet,
        start,
        [
          { header: 'N.°', width: 6, numFmt: '0', align: 'center' },
          { header: 'Tipo de falta', width: 36 },
          { header: 'Cantidad', width: 12, numFmt: '0', bar: 'blue' },
          { header: '% del total', width: 12, numFmt: '0.0%' },
          { header: '% acumulado', width: 13, numFmt: '0%' },
        ],
        stats.topFaults.map((f, i) => {
          acc += f.count;
          return [i + 1, f.faultType, f.count, total > 0 ? f.count / total : 0, total > 0 ? acc / total : 0];
        }),
      );
      if (stats.topFaults.length >= 3) {
        writeNote(sheet, pos.last + 2, `Las tres faltas más comunes suman el ${Math.round(insights.incidents.top3Share * 100)}% de las incidencias.`, 5);
      }
      place(
        sheet,
        5,
        start,
        chartFrom(pos, {
          kind: 'bar',
          title: 'Faltas más frecuentes',
          catCol: 2,
          cats: stats.topFaults.map((f) => f.faultType),
          series: [{ name: 'Cantidad', col: 3, values: stats.topFaults.map((f) => f.count), color: HEX_BLUE }],
          limit: 10,
        }),
        [620, 380],
      );
    }

    // ── Gravedad
    {
      const { sheet, row: start } = await newSheet(workbook, 'Gravedad', 'NIVEL DE REINCIDENCIA', subtitle, 4, 'FFB91C1C');
      const levels = [0, 1, 2, 3, 4, 5].filter((l) => l < 5 || (stats.levelDistribution.level5 ?? 0) > 0);
      const values = levels.map((l) => stats.levelDistribution[`level${l}`] ?? 0);
      const labels = levels.map((l) => `Nivel ${l} · ${getReincidenceLevelSummaryLabel(l as ReincidenceLevel)}`);
      const pos = writeTable(
        sheet,
        start,
        [
          { header: 'Nivel', width: 36 },
          { header: 'Incidencias', width: 13, numFmt: '0', bar: 'blue' },
          { header: '% del total', width: 12, numFmt: '0.0%' },
        ],
        levels.map((_, i) => [labels[i], values[i], total > 0 ? values[i] / total : 0]),
      );
      writeNote(sheet, pos.last + 2, `Casos críticos (nivel 3 o más): ${insights.incidents.critical}.`, 3);
      place(
        sheet,
        3,
        start,
        chartFrom(pos, {
          kind: 'doughnut',
          title: 'Incidencias por nivel de reincidencia',
          catCol: 1,
          cats: labels,
          series: [{ name: 'Incidencias', col: 2, values, color: HEX_BLUE, pointColors: levels.map((l) => LEVEL_HEX[l]) }],
        }),
        [560, 320],
      );
    }

    // ── Por grado
    if (!isStudent && data.byGrade.length > 0) {
      const { sheet, row: start } = await newSheet(workbook, 'Por grado', 'COMPARATIVA POR GRADOS', subtitle, 11, 'FF7C3AED');
      const multi = new Set(data.byGrade.map((g) => g.level)).size > 1;
      const cats = data.byGrade.map((g) => (multi ? `${LEVEL_SHORT[g.level] ?? g.level} ${g.grade}` : g.grade));
      const pos = writeTable(
        sheet,
        start,
        [
          { header: 'Grado', width: 12 },
          { header: 'Nivel educativo', width: 14 },
          { header: 'Incidencias', width: 12, numFmt: '0', scale: 'blue' },
          { header: 'Estudiantes', width: 12, numFmt: '0' },
          { header: 'Por estudiante', width: 14, numFmt: '0.0', bar: 'blue' },
          { header: 'Nivel prom.', width: 11, numFmt: '0.00' },
          { header: 'Nivel 0', width: 9, numFmt: '0' },
          { header: 'Nivel 1', width: 9, numFmt: '0' },
          { header: 'Nivel 2', width: 9, numFmt: '0' },
          { header: 'Nivel 3', width: 9, numFmt: '0' },
          { header: 'Nivel 4', width: 9, numFmt: '0' },
        ],
        data.byGrade.map((g, i) => [
          cats[i],
          g.level,
          g.totalIncidents,
          g.studentsWithIncidents,
          g.studentsWithIncidents > 0 ? g.totalIncidents / g.studentsWithIncidents : 0,
          g.averageReincidence,
          g.levelDistribution.level0,
          g.levelDistribution.level1,
          g.levelDistribution.level2,
          g.levelDistribution.level3,
          g.levelDistribution.level4,
        ]),
      );
      place(
        sheet,
        11,
        start,
        chartFrom(pos, {
          kind: 'stackedCol',
          title: 'Incidencias por grado y nivel de reincidencia',
          catCol: 1,
          cats,
          series: (['level0', 'level1', 'level2', 'level3', 'level4'] as const).map((k, i) => ({
            name: `Nivel ${i}`,
            col: 7 + i,
            values: data.byGrade.map((g) => g.levelDistribution[k]),
            color: LEVEL_HEX[i],
          })),
          showValues: false,
        }),
        [680, 360],
      );
    }

    // ── Por sección
    if (!isStudent && data.bySection.length > 0) {
      const { sheet, row: start } = await newSheet(workbook, 'Por sección', 'COMPARATIVA POR SECCIONES', subtitle, 7, 'FF7C3AED');
      const multi = new Set(data.bySection.map((g) => g.level)).size > 1;
      const ranked = [...data.bySection].sort((a, b) => b.totalIncidents - a.totalIncidents);
      const cats = ranked.map((s) => `${multi ? `${LEVEL_SHORT[s.level] ?? s.level} ` : ''}${s.grade} ${s.section}`);
      const pos = writeTable(
        sheet,
        start,
        [
          { header: 'Aula', width: 14 },
          { header: 'Nivel educativo', width: 14 },
          { header: 'Grado', width: 9 },
          { header: 'Sección', width: 9, align: 'center' },
          { header: 'Incidencias', width: 12, numFmt: '0', scale: 'blue' },
          { header: 'Estudiantes', width: 12, numFmt: '0' },
          { header: 'Nivel prom.', width: 11, numFmt: '0.00' },
          { header: '% del total', width: 11, numFmt: '0.0%' },
        ],
        ranked.map((s, i) => [cats[i], s.level, s.grade, s.section, s.totalIncidents, s.studentsWithIncidents, s.averageReincidence, total > 0 ? s.totalIncidents / total : 0]),
      );
      place(
        sheet,
        8,
        start,
        chartFrom(pos, {
          kind: 'bar',
          title: 'Secciones con más incidencias',
          catCol: 1,
          cats,
          series: [{ name: 'Incidencias', col: 5, values: ranked.map((s) => s.totalIncidents), color: HEX_BLUE }],
          limit: 15,
        }),
        [620, 420],
      );
    }

    // ── Tardanzas
    const lateness = data.lateness;
    if (!isStudent && lateness) {
      {
        const { sheet, row: start } = await newSheet(workbook, 'Tardanzas por aula', 'TARDANZAS POR AULA', subtitle, 8, ORANGE);
        const ranked = [...lateness.classrooms].sort((a, b) => b.lateCount - a.lateCount);
        const pos = writeTable(
          sheet,
          start,
          [
            { header: 'Aula', width: 14 },
            { header: 'Nivel educativo', width: 14 },
            { header: 'Grado', width: 9 },
            { header: 'Sección', width: 9, align: 'center' },
            { header: 'Estudiantes activos', width: 17, numFmt: '0' },
            { header: 'Con tardanza', width: 13, numFmt: '0' },
            { header: '% del aula', width: 11, numFmt: '0%', bar: 'orange' },
            { header: 'Tardanzas', width: 11, numFmt: '0', scale: 'orange' },
          ],
          ranked.map((c) => [c.label, c.level, c.grade, c.section, c.enrolled, c.studentsLate, c.studentRate ?? 0, c.lateCount]),
        );
        const tc = insights.lateness?.topClassroom;
        if (tc) {
          writeNote(sheet, pos.last + 2, `Aula con más tardanzas: ${tc.label} (${tc.lateCount}). «% del aula» es la parte de sus estudiantes que llegó tarde al menos una vez.`, 8);
        }
        place(
          sheet,
          8,
          start,
          chartFrom(pos, {
            kind: 'bar',
            title: 'Aulas con más tardanzas',
            catCol: 1,
            cats: ranked.map((c) => c.label),
            series: [{ name: 'Tardanzas', col: 8, values: ranked.map((c) => c.lateCount), color: HEX_ORANGE }],
            limit: 12,
          }),
          [600, 400],
        );
      }
      if (insights.lateness && insights.lateness.months.length > 0) {
        const { sheet, row: start } = await newSheet(workbook, 'Tardanzas por mes', 'TARDANZAS POR MES', subtitle, 3, ORANGE);
        const months = insights.lateness.months;
        const cats = months.map((m) => m.label[0].toUpperCase() + m.label.slice(1));
        const pos = writeTable(
          sheet,
          start,
          [
            { header: 'Mes', width: 14 },
            { header: 'Tardanzas', width: 12, numFmt: '0', bar: 'orange' },
            { header: '% del total', width: 12, numFmt: '0.0%' },
          ],
          months.map((m, i) => [cats[i], m.lateCount, lateness.totalLate > 0 ? m.lateCount / lateness.totalLate : 0]),
        );
        place(
          sheet,
          3,
          start,
          chartFrom(pos, {
            kind: 'col',
            title: 'Tardanzas por mes',
            catCol: 1,
            cats,
            series: [{ name: 'Tardanzas', col: 2, values: months.map((m) => m.lateCount), color: HEX_ORANGE }],
          }),
        );
      }
      if (lateness.students.length > 0) {
        const { sheet, row: start } = await newSheet(workbook, 'Tardanzas por estudiante', 'ESTUDIANTES CON TARDANZAS', subtitle, 7, ORANGE);
        const pos = writeTable(
          sheet,
          start,
          [
            { header: 'Estudiante', width: 34 },
            { header: 'Aula', width: 13 },
            { header: 'Tardanzas', width: 11, numFmt: '0', bar: 'orange' },
            { header: 'Justificadas', width: 12, numFmt: '0' },
            { header: 'Retraso prom. (min)', width: 17, numFmt: '0' },
            { header: 'Última fecha', width: 13, numFmt: 'dd/mm/yyyy' },
            { header: 'Última hora', width: 11, align: 'center' },
          ],
          lateness.students.map((s) => [
            s.studentName,
            s.classroomLabel,
            s.lateCount,
            s.justifiedCount,
            s.avgMinutesLate == null ? null : Math.round(s.avgMinutesLate),
            new Date(`${s.lastDate}T12:00:00`),
            s.lastTime,
          ]),
        );
        place(
          sheet,
          7,
          start,
          chartFrom(pos, {
            kind: 'bar',
            title: 'Estudiantes con más tardanzas',
            catCol: 1,
            cats: lateness.students.map((s) => s.studentName),
            series: [{ name: 'Tardanzas', col: 3, values: lateness.students.map((s) => s.lateCount), color: HEX_ORANGE }],
            limit: 15,
          }),
          [620, 420],
        );
      }
    }

    // ── Detalle
    if (incidents.length > 0) {
      const { sheet, row: start } = await newSheet(workbook, 'Detalle incidencias', 'DETALLE DE INCIDENCIAS', `${subtitle} · ${incidents.length} registros`, 12, 'FF64748B');
      writeTable(
        sheet,
        start,
        [
          { header: 'ID', width: 8, numFmt: '0', align: 'center' },
          { header: 'Fecha', width: 12, numFmt: 'dd/mm/yyyy' },
          { header: 'Hora', width: 8, align: 'center' },
          { header: 'Estudiante', width: 32 },
          { header: 'Nivel', width: 12 },
          { header: 'Grado', width: 8 },
          { header: 'Sección', width: 9, align: 'center' },
          { header: 'Tipo de falta', width: 30 },
          { header: 'Categoría', width: 16 },
          { header: 'Nivel reinc.', width: 11, numFmt: '0', align: 'center' },
          { header: 'Estado', width: 14 },
          { header: 'Observaciones', width: 44 },
        ],
        [...incidents]
          .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
          .map((inc) => {
            const d = new Date(inc.registeredAt);
            return [
              inc.id,
              d,
              format(d, 'HH:mm'),
              inc.student?.fullName ?? '',
              inc.student?.level ?? '',
              inc.student?.grade ?? '',
              inc.student?.section ?? '',
              inc.faultType?.name ?? '',
              inc.faultType?.category ?? '',
              inc.reincidenceLevel,
              inc.status,
              inc.observations ?? '',
            ];
          }),
      );
    }

    // Todos los gráficos también en «Resumen», uno debajo de otro (cada fila ≈ 20 px)
    let at = chartsStartRow - 1;
    for (const spec of summaryCharts) {
      const h = 330;
      charts.push({ ...spec, sheet: 'Resumen', col: 0, row: at, widthPx: 760, heightPx: h });
      at += Math.ceil(h / 20) + 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = await injectCharts(buffer, charts);
    const name = isStudent
      ? `Informe_${data.studentName!.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      : `Informe_Convivencia_Puntualidad_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}
