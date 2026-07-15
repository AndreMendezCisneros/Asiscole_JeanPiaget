// @ts-nocheck
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DashboardStats, Incident } from '@/types';
import {
  addBrandedExcelHeader,
  addExcelWatermark,
  addReportHeader,
  autoFitColumns,
  createWorkbook,
  defaultExportFilename,
  EXCEL_COLORS,
  freezePane,
  runExcelExport,
  saveWorkbook,
  setColumnWidths,
  styleDataRows,
  styleHeaderRow,
} from '@/lib/utils/excelExport';

type LevelItem = { level: string; count: number };

export async function exportIncidentsReportExcel(
  stats: DashboardStats,
  incidentsList: Incident[],
  options: {
    filterText: string;
    levelItems: LevelItem[];
  }
): Promise<void> {
  if (!stats) throw new Error('No hay estadísticas para exportar');
  if (incidentsList.length === 0) throw new Error('No hay incidencias para exportar');

  await runExcelExport('reporte de incidencias', async () => {
    const workbook = createWorkbook('Reporte de incidencias');

    const summarySheet = workbook.addWorksheet('Resumen', { views: [{ showGridLines: true }] });
    let row = await addBrandedExcelHeader(
      workbook,
      summarySheet,
      'REPORTE DE INCIDENCIAS',
      options.filterText,
      4
    );

    const writeSection = (title: string, entries: [string, string | number][]) => {
      const titleRow = summarySheet.getRow(row);
      titleRow.getCell(1).value = title;
      titleRow.getCell(1).font = { size: 12, bold: true, color: { argb: EXCEL_COLORS.title } };
      row += 1;
      entries.forEach(([label, value]) => {
        const r = summarySheet.getRow(row);
        r.getCell(1).value = label;
        r.getCell(2).value = value;
        r.getCell(1).font = { bold: true, size: 10 };
        r.getCell(2).font = { size: 10 };
        row += 1;
      });
      row += 1;
    };

    writeSection('RESUMEN GENERAL', [
      ['Total incidencias', stats.totalIncidents],
      ['Estudiantes involucrados', stats.studentsWithIncidents],
      ['Nivel promedio reincidencia', stats.averageReincidenceLevel.toFixed(1)],
      [
        'Casos críticos (nivel 3-4)',
        stats.levelDistribution.level3 + stats.levelDistribution.level4,
      ],
    ]);

    const levelRows: [string, string | number][] = options.levelItems.map((item) => {
      const pct =
        stats.totalIncidents > 0
          ? `${((item.count / stats.totalIncidents) * 100).toFixed(1)}%`
          : '0%';
      return [item.level, `${item.count} (${pct})`];
    });
    writeSection('DISTRIBUCIÓN POR NIVEL', levelRows);

    const faultRows: [string, string | number][] = stats.topFaults.map((fault, index) => {
      const pct =
        stats.totalIncidents > 0
          ? `${((fault.count / stats.totalIncidents) * 100).toFixed(1)}%`
          : '0%';
      return [`${index + 1}. ${fault.faultType}`, `${fault.count} (${pct})`];
    });
    writeSection('FALTAS MÁS FRECUENTES', faultRows);

    setColumnWidths(summarySheet, [36, 22, 14, 14]);

    const detailsSheet = workbook.addWorksheet('Detalle', { views: [{ showGridLines: true }] });
    const detailStart = await addBrandedExcelHeader(
      workbook,
      detailsSheet,
      'DETALLE DE INCIDENCIAS',
      `${options.filterText} · ${incidentsList.length} registro(s)`,
      11
    );

    const headers = [
      'ID',
      'Estudiante',
      'Nivel',
      'Grado',
      'Sección',
      'Tipo de falta',
      'Categoría',
      'Nivel reincidencia',
      'Fecha',
      'Hora',
      'Estado',
      'Observaciones',
    ];
    const headerRow = detailsSheet.addRow(headers);
    styleHeaderRow(headerRow);

    incidentsList.forEach((incident) => {
      detailsSheet.addRow([
        incident.id,
        incident.student?.fullName || 'N/A',
        incident.student?.level || 'N/A',
        incident.student?.grade || 'N/A',
        incident.student?.section || 'N/A',
        incident.faultType?.name || 'N/A',
        incident.faultType?.category || 'N/A',
        incident.reincidenceLevel,
        format(new Date(incident.registeredAt), 'dd/MM/yyyy', { locale: es }),
        format(new Date(incident.registeredAt), 'HH:mm', { locale: es }),
        incident.status,
        incident.observations || '',
      ]);
    });

    const lastRow = detailStart + incidentsList.length;
    if (incidentsList.length > 0) {
      styleDataRows(detailsSheet, detailStart + 1, lastRow, { zebra: true });
    }
    freezePane(detailsSheet, detailStart);
    setColumnWidths(detailsSheet, [8, 28, 12, 10, 8, 24, 14, 12, 12, 8, 12, 40]);
    autoFitColumns(detailsSheet, 8, 42);

    await addExcelWatermark(workbook, summarySheet, {
      mergeCols: 4,
      centerRow: 12,
    });
    await addExcelWatermark(workbook, detailsSheet, {
      mergeCols: 11,
      centerRow: detailStart + Math.max(5, Math.floor(incidentsList.length / 2)),
    });

    await saveWorkbook(workbook, defaultExportFilename('Reporte_Incidencias'));
  });
}
