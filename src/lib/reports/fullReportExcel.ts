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
  saveWorkbook,
  setColumnWidths,
  styleDataRows,
  styleHeaderRow,
} from '@/lib/utils/excelExport';
import { getReincidenceLevelBarColor, getReincidenceLevelSummaryLabel } from '@/lib/utils/reincidenceUtils';
import { buildReportInsights, type ReportExportData } from './reportInsights';
import {
  areaTrendChart,
  donutChart,
  heatmapChart,
  horizontalBarChart,
  ORANGE_RAMP,
  type ChartImage,
} from './chartImages';

const BLUE = 'FF2F63B8';
const ORANGE = 'FFD4501F';
const PALE = 'FFF5F7FA';
const LEVEL_SHORT: Record<string, string> = { Primaria: 'Prim.', Secundaria: 'Sec.', Inicial: 'Inic.' };

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

function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Tabla con cabecera de marca, cebra, formatos, filtro, barras de datos y escala de color. */
function writeTable(sheet: ExcelJS.Worksheet, startRow: number, cols: Col[], rows: unknown[][]): number {
  const header = sheet.getRow(startRow);
  cols.forEach((c, i) => (header.getCell(i + 1).value = c.header));
  styleHeaderRow(header);
  rows.forEach((r, i) => {
    const row = sheet.getRow(startRow + 1 + i);
    r.forEach((v, j) => (row.getCell(j + 1).value = v as ExcelJS.CellValue));
  });
  const last = startRow + rows.length;
  if (rows.length > 0) {
    styleDataRows(sheet, startRow + 1, last, { zebra: true });
    cols.forEach((c, j) => {
      const col = sheet.getColumn(j + 1);
      for (let r = startRow + 1; r <= last; r++) {
        const cell = sheet.getRow(r).getCell(j + 1);
        if (c.numFmt) cell.numFmt = c.numFmt;
        cell.alignment = { vertical: 'middle', horizontal: c.align ?? (c.numFmt ? 'right' : 'left'), wrapText: !c.numFmt };
      }
      const ref = `${colLetter(j + 1)}${startRow + 1}:${colLetter(j + 1)}${last}`;
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
      col.width = c.width;
    });
    sheet.autoFilter = { from: { row: startRow, column: 1 }, to: { row: last, column: cols.length } };
  }
  freezePane(sheet, startRow);
  return last + 2;
}

async function newSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  cols: number,
  tab: string,
): Promise<{ sheet: ExcelJS.Worksheet; row: number }> {
  const sheet = workbook.addWorksheet(name, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: tab } },
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const row = await addBrandedExcelHeader(workbook, sheet, title, subtitle, Math.max(cols, 4));
  return { sheet, row };
}

function writeNote(sheet: ExcelJS.Worksheet, row: number, text: string, cols: number): number {
  const cell = sheet.getRow(row).getCell(1);
  cell.value = text;
  cell.font = { size: 10, color: { argb: 'FF0F172A' } };
  cell.alignment = { wrapText: true, vertical: 'top' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  cell.border = { left: { style: 'thick', color: { argb: BLUE } } };
  sheet.mergeCells(row, 1, row, cols);
  sheet.getRow(row).height = Math.max(20, Math.ceil(text.length / (cols * 11)) * 15 + 6);
  return row + 2;
}

function addChart(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, row: number, image: ChartImage, widthPx: number): number {
  const id = workbook.addImage({ base64: image.dataUrl, extension: 'png' });
  const heightPx = Math.round((image.height / image.width) * widthPx);
  sheet.addImage(id, { tl: { col: 0, row: row - 1 }, ext: { width: widthPx, height: heightPx } });
  return row + Math.ceil(heightPx / 20) + 1;
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

/**
 * Libro de Excel del informe: hoja «Resumen» con cifras, resumen ejecutivo y gráficos;
 * una hoja por análisis (mensual, faltas, gravedad, grados, secciones, tardanzas) y el detalle.
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

    // ── Resumen
    {
      const COLS = 8;
      const { sheet, row: r0 } = await newSheet(workbook, 'Resumen', isStudent ? 'INFORME DEL ESTUDIANTE' : 'INFORME DE CONVIVENCIA Y PUNTUALIDAD', subtitle, COLS, BLUE);
      setColumnWidths(sheet, [26, 14, 4, 26, 14, 4, 14, 14]);
      let row = r0;
      sheet.getRow(row).getCell(1).value = `Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`;
      sheet.getRow(row).getCell(1).font = { size: 9, italic: true, color: { argb: EXCEL_COLORS.subtitle } };
      row += 2;

      row = sectionTitle(sheet, row, 'Cifras clave', COLS);
      const kpis: [string, string | number, string, string | number][] = [
        ['Incidencias', total, 'Tardanzas', insights.lateness?.total ?? '—'],
        [isStudent ? 'Nivel promedio' : 'Estudiantes con incidencias', isStudent ? Number(stats.averageReincidenceLevel.toFixed(1)) : stats.studentsWithIncidents, 'Estudiantes con tardanza', insights.lateness?.students ?? '—'],
        ['Casos críticos (nivel 3+)', insights.incidents.critical, '% de llegadas tarde', insights.lateness?.rate ?? '—'],
        ['Mes con más incidencias', insights.incidents.peakMonth ? `${insights.incidents.peakMonth.month} (${insights.incidents.peakMonth.incidents})` : '—', 'Aula con más tardanzas', insights.lateness?.topClassroom ? `${insights.lateness.topClassroom.label} (${insights.lateness.topClassroom.lateCount})` : '—'],
        ['Falta más frecuente', insights.incidents.topFault ? `${insights.incidents.topFault.faultType} (${insights.incidents.topFault.count})` : '—', 'Mes con más tardanzas', insights.lateness?.peakMonth ? `${insights.lateness.peakMonth.label} (${insights.lateness.peakMonth.lateCount})` : '—'],
      ];
      for (const [l1, v1, l2, v2] of kpis) {
        const rr = sheet.getRow(row);
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
          if (typeof value === 'number' && value < 1 && value > 0 && label.startsWith('%')) vc.numFmt = '0.0%';
        };
        put(1, l1, v1, BLUE);
        if (!isStudent) put(4, l2, v2, ORANGE);
        row += 1;
      }
      row += 1;

      row = sectionTitle(sheet, row, 'Resumen ejecutivo', COLS);
      for (const s of insights.summary) row = writeNote(sheet, row, `•  ${s}`, COLS) - 1;
      row += 1;
      if (insights.alerts.length > 0) {
        row = sectionTitle(sheet, row, 'Puntos de atención', COLS);
        for (const a of insights.alerts) {
          const next = writeNote(sheet, row, `!  ${a}`, COLS);
          sheet.getRow(row).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          sheet.getRow(row).getCell(1).border = { left: { style: 'thick', color: { argb: 'FFB45F06' } } };
          row = next - 1;
        }
        row += 1;
      }

      row = sectionTitle(sheet, row, 'Gráficos', COLS);
      if (data.monthlyTrend.length > 0) {
        row = addChart(workbook, sheet, row, areaTrendChart(data.monthlyTrend.map((m) => ({ label: m.month, value: m.incidents }))), 760);
      }
      if (stats.topFaults.length > 0) {
        row = addChart(
          workbook,
          sheet,
          row,
          horizontalBarChart(stats.topFaults.slice(0, 8).map((f) => ({ label: f.faultType, value: f.count })), {
            strongTop: 3,
            valueFormatter: (v) => `${v} · ${total > 0 ? Math.round((v / total) * 100) : 0}%`,
          }),
          760,
        );
      }
      row = addChart(
        workbook,
        sheet,
        row,
        donutChart(
          [0, 1, 2, 3, 4].map((l) => ({
            label: `Nivel ${l} · ${getReincidenceLevelSummaryLabel(l as ReincidenceLevel)}`,
            value: stats.levelDistribution[`level${l}`] ?? 0,
            color: getReincidenceLevelBarColor(l),
          })),
          { width: 520, height: 200, centerLabel: 'incidencias' },
        ),
        560,
      );
      if (!isStudent && data.lateness && data.lateness.classrooms.length > 0) {
        const multi = new Set(data.lateness.classrooms.map((c) => c.level)).size > 1;
        const sections = [...new Set(data.lateness.classrooms.map((c) => c.section))].sort();
        const rowsMap = new Map<string, { label: string; cells: (number | null)[] }>();
        for (const c of data.lateness.classrooms) {
          const key = `${c.level}|${c.grade}`;
          if (!rowsMap.has(key)) rowsMap.set(key, { label: multi ? `${LEVEL_SHORT[c.level] ?? c.level} ${c.grade}` : c.grade, cells: sections.map(() => null) });
          rowsMap.get(key)!.cells[sections.indexOf(c.section)] = c.lateCount;
        }
        row = addChart(workbook, sheet, row, heatmapChart([...rowsMap.values()], sections, { ramp: ORANGE_RAMP, legend: ['Menos', 'Más tardanzas'] }), 760);
      }
      void row;
    }

    // ── Mensual
    if (data.monthlyTrend.length > 0) {
      const { sheet, row } = await newSheet(workbook, 'Mensual', 'INCIDENCIAS POR MES', subtitle, 4, BLUE);
      const avg = insights.incidents.average;
      const next = writeTable(
        sheet,
        row,
        [
          { header: 'Mes', width: 16 },
          { header: 'Incidencias', width: 16, numFmt: '0', bar: 'blue' },
          { header: 'Frente al promedio', width: 20, numFmt: '+0.0;-0.0;0.0' },
          { header: 'Variación mensual', width: 20, numFmt: '+0%;-0%;0%' },
        ],
        data.monthlyTrend.map((m, i) => {
          const prev = i > 0 ? data.monthlyTrend[i - 1].incidents : null;
          return [m.month, m.incidents, m.incidents - avg, prev ? (m.incidents - prev) / prev : null];
        }),
      );
      writeNote(sheet, next, `Promedio mensual: ${avg.toFixed(1)}. Mes pico: ${insights.incidents.peakMonth ? `${insights.incidents.peakMonth.month} (${insights.incidents.peakMonth.incidents})` : '—'}.`, 4);
    }

    // ── Faltas
    if (stats.topFaults.length > 0) {
      const { sheet, row } = await newSheet(workbook, 'Faltas', 'FALTAS MÁS FRECUENTES', subtitle, 5, BLUE);
      let acc = 0;
      const next = writeTable(
        sheet,
        row,
        [
          { header: '#', width: 6, numFmt: '0', align: 'center' },
          { header: 'Tipo de falta', width: 40 },
          { header: 'Cantidad', width: 14, numFmt: '0', bar: 'blue' },
          { header: '% del total', width: 14, numFmt: '0.0%' },
          { header: '% acumulado', width: 14, numFmt: '0%' },
        ],
        stats.topFaults.map((f, i) => {
          acc += f.count;
          return [i + 1, f.faultType, f.count, total > 0 ? f.count / total : 0, total > 0 ? acc / total : 0];
        }),
      );
      if (stats.topFaults.length >= 3) writeNote(sheet, next, `Las tres faltas más comunes suman el ${Math.round(insights.incidents.top3Share * 100)}% de las incidencias.`, 5);
    }

    // ── Gravedad
    {
      const { sheet, row } = await newSheet(workbook, 'Gravedad', 'NIVEL DE REINCIDENCIA', subtitle, 4, 'FFB91C1C');
      const levels = [0, 1, 2, 3, 4, 5].filter((l) => l < 5 || (stats.levelDistribution.level5 ?? 0) > 0);
      const next = writeTable(
        sheet,
        row,
        [
          { header: 'Nivel', width: 10, numFmt: '0', align: 'center' },
          { header: 'Descripción', width: 30 },
          { header: 'Incidencias', width: 14, numFmt: '0', bar: 'blue' },
          { header: '% del total', width: 14, numFmt: '0.0%' },
        ],
        levels.map((l) => {
          const v = stats.levelDistribution[`level${l}`] ?? 0;
          return [l, getReincidenceLevelSummaryLabel(l as ReincidenceLevel), v, total > 0 ? v / total : 0];
        }),
      );
      writeNote(sheet, next, `Casos críticos (nivel 3 o más): ${insights.incidents.critical}.`, 4);
    }

    // ── Por grado / sección
    if (!isStudent && data.byGrade.length > 0) {
      const { sheet, row } = await newSheet(workbook, 'Por grado', 'COMPARATIVA POR GRADOS', subtitle, 10, 'FF7C3AED');
      writeTable(
        sheet,
        row,
        [
          { header: 'Nivel', width: 12 },
          { header: 'Grado', width: 10 },
          { header: 'Incidencias', width: 13, numFmt: '0', scale: 'blue' },
          { header: 'Estudiantes', width: 13, numFmt: '0' },
          { header: 'Por estudiante', width: 15, numFmt: '0.0', bar: 'blue' },
          { header: 'Nivel prom.', width: 12, numFmt: '0.00' },
          { header: 'Nivel 0', width: 10, numFmt: '0' },
          { header: 'Nivel 1', width: 10, numFmt: '0' },
          { header: 'Nivel 2', width: 10, numFmt: '0' },
          { header: 'Nivel 3', width: 10, numFmt: '0' },
          { header: 'Nivel 4', width: 10, numFmt: '0' },
        ],
        data.byGrade.map((g) => [
          g.level,
          g.grade,
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
    }
    if (!isStudent && data.bySection.length > 0) {
      const { sheet, row } = await newSheet(workbook, 'Por sección', 'COMPARATIVA POR SECCIONES', subtitle, 7, 'FF7C3AED');
      writeTable(
        sheet,
        row,
        [
          { header: 'Nivel', width: 12 },
          { header: 'Grado', width: 10 },
          { header: 'Sección', width: 10, align: 'center' },
          { header: 'Incidencias', width: 13, numFmt: '0', scale: 'blue' },
          { header: 'Estudiantes', width: 13, numFmt: '0' },
          { header: 'Nivel prom.', width: 12, numFmt: '0.00' },
          { header: '% del total', width: 12, numFmt: '0.0%' },
        ],
        [...data.bySection]
          .sort((a, b) => b.totalIncidents - a.totalIncidents)
          .map((s) => [s.level, s.grade, s.section, s.totalIncidents, s.studentsWithIncidents, s.averageReincidence, total > 0 ? s.totalIncidents / total : 0]),
      );
    }

    // ── Tardanzas
    const lateness = data.lateness;
    if (!isStudent && lateness) {
      {
        const { sheet, row } = await newSheet(workbook, 'Tardanzas por aula', 'TARDANZAS POR AULA', subtitle, 7, ORANGE);
        const next = writeTable(
          sheet,
          row,
          [
            { header: 'Nivel', width: 12 },
            { header: 'Grado', width: 10 },
            { header: 'Sección', width: 10, align: 'center' },
            { header: 'Estudiantes activos', width: 18, numFmt: '0' },
            { header: 'Con tardanza', width: 14, numFmt: '0' },
            { header: '% del aula', width: 12, numFmt: '0%', bar: 'orange' },
            { header: 'Tardanzas', width: 12, numFmt: '0', scale: 'orange' },
          ],
          [...lateness.classrooms]
            .sort((a, b) => b.lateCount - a.lateCount)
            .map((c) => [c.level, c.grade, c.section, c.enrolled, c.studentsLate, c.studentRate ?? 0, c.lateCount]),
        );
        const tc = insights.lateness?.topClassroom;
        if (tc) writeNote(sheet, next, `Aula con más tardanzas: ${tc.label} (${tc.lateCount}). «% del aula» es la parte de sus estudiantes que llegó tarde al menos una vez.`, 7);
      }
      if (lateness.students.length > 0) {
        const { sheet, row } = await newSheet(workbook, 'Tardanzas por estudiante', 'ESTUDIANTES CON TARDANZAS', subtitle, 7, ORANGE);
        writeTable(
          sheet,
          row,
          [
            { header: 'Estudiante', width: 36 },
            { header: 'Aula', width: 14 },
            { header: 'Tardanzas', width: 12, numFmt: '0', bar: 'orange' },
            { header: 'Justificadas', width: 13, numFmt: '0' },
            { header: 'Retraso prom. (min)', width: 18, numFmt: '0' },
            { header: 'Última fecha', width: 14, numFmt: 'dd/mm/yyyy' },
            { header: 'Última hora', width: 12, align: 'center' },
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
      }
      if (insights.lateness && insights.lateness.months.length > 0) {
        const { sheet, row } = await newSheet(workbook, 'Tardanzas por mes', 'TARDANZAS POR MES', subtitle, 3, ORANGE);
        writeTable(
          sheet,
          row,
          [
            { header: 'Mes', width: 16 },
            { header: 'Tardanzas', width: 14, numFmt: '0', bar: 'orange' },
            { header: '% del total', width: 14, numFmt: '0.0%' },
          ],
          insights.lateness.months.map((m) => [m.label, m.lateCount, lateness.totalLate > 0 ? m.lateCount / lateness.totalLate : 0]),
        );
      }
    }

    // ── Detalle
    if (incidents.length > 0) {
      const { sheet, row } = await newSheet(workbook, 'Detalle incidencias', 'DETALLE DE INCIDENCIAS', `${subtitle} · ${incidents.length} registros`, 12, 'FF64748B');
      writeTable(
        sheet,
        row,
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

    const name = isStudent
      ? `Informe_${data.studentName!.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      : `Informe_Convivencia_Puntualidad_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    await saveWorkbook(workbook, name);
  });
}
