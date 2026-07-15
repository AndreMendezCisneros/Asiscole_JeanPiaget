// @ts-nocheck
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { getRoundedReportLogoBuffer, getWatermarkLogoBuffer } from '@/lib/utils/reportLogo';

/** Colores institucionales SIE (ARGB) */
export const EXCEL_COLORS = {
  headerBg: 'FF1E4A7A',
  headerFg: 'FFFFFFFF',
  title: 'FF0F172A',
  subtitle: 'FF64748B',
  altRow: 'FFF8FAFC',
  border: 'FFDCE3ED',
  summaryBg: 'FFEFF6FF',
} as const;

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: EXCEL_COLORS.border } };
  return { top: side, left: side, bottom: side, right: side };
}

/** Logo Guardy con esquinas redondeadas para hojas de cálculo */
export async function loadInstitutionLogo(): Promise<{ buffer: ArrayBuffer; extension: 'png' } | null> {
  return getRoundedReportLogoBuffer({ maxWidth: 200, maxHeight: 72, radiusPx: 14 });
}

export function createWorkbook(title?: string): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIE - Sistema de Incidencias Escolares';
  workbook.created = new Date();
  workbook.modified = new Date();
  if (title) workbook.title = title;
  return workbook;
}

export async function addLogo(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  position: { col?: number; row?: number; width?: number; height?: number } = {}
): Promise<void> {
  const logo = await loadInstitutionLogo();
  if (!logo) return;

  const width = position.width ?? 118;
  const height = position.height ?? 48;

  sheet.getRow(1).height = Math.max(sheet.getRow(1).height ?? 0, 42);
  sheet.getRow(2).height = 6;

  for (let c = 1; c <= 10; c++) {
    const cell = sheet.getCell(1, c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
  }

  const imageId = workbook.addImage(logo);
  sheet.addImage(imageId, {
    tl: { col: position.col ?? 0.15, row: position.row ?? 0.1 },
    ext: { width, height },
  });
}

/**
 * Marca de agua Guardy al centro de la hoja (escuela usa el sistema).
 * Se coloca detrás visualmente gracias a la opacidad baja del PNG.
 */
export async function addExcelWatermark(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  options?: { mergeCols?: number; centerRow?: number }
): Promise<void> {
  const wm = await getWatermarkLogoBuffer(0.1);
  if (!wm) return;

  const cols = options?.mergeCols ?? 10;
  const centerRow = options?.centerRow ?? 14;
  const col = Math.max(0.3, cols / 2 - 2.2);

  const imageId = workbook.addImage(wm);
  sheet.addImage(imageId, {
    tl: { col, row: centerRow },
    ext: { width: 340, height: 300 },
  });

  const footRow = sheet.lastRow?.number ? sheet.lastRow.number + 2 : centerRow + 22;
  const foot = sheet.getRow(footRow);
  foot.getCell(1).value = 'Documento generado con SIE — Sistema Guardy';
  foot.getCell(1).font = {
    size: 9,
    italic: true,
    color: { argb: 'FF94A3B8' },
  };
  sheet.mergeCells(footRow, 1, footRow, Math.max(cols, 6));
  foot.getCell(1).alignment = { horizontal: 'center' };
}

/** Cabecera con logo Guardy + título del reporte */
export async function addBrandedExcelHeader(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
  mergeCols = 8
): Promise<number> {
  await addLogo(workbook, sheet);
  return addReportHeader(sheet, 4, title, subtitle, mergeCols);
}

/** Fila de título + subtítulo; devuelve la fila donde empezar la tabla */
export function addReportHeader(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  subtitle?: string,
  mergeCols = 8
): number {
  let row = startRow;
  const titleRow = sheet.getRow(row);
  titleRow.height = 30;
  const titleCell = titleRow.getCell(1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: EXCEL_COLORS.title } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.mergeCells(row, 1, row, mergeCols);
  row += 1;

  if (subtitle) {
    const subRow = sheet.getRow(row);
    subRow.getCell(1).value = subtitle;
    subRow.getCell(1).font = { size: 10, color: { argb: EXCEL_COLORS.subtitle } };
    subRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    sheet.mergeCells(row, 1, row, mergeCols);
    row += 1;
  }

  sheet.addRow([]);
  return row + 1;
}

export function styleHeaderRow(row: ExcelJS.Row): void {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.headerFg } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.headerBg } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder();
  });
}

export function styleDataRows(
  sheet: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  options?: { zebra?: boolean; fontSize?: number }
): void {
  const fontSize = options?.fontSize ?? 10;
  for (let r = fromRow; r <= toRow; r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      cell.font = { size: fontSize, color: { argb: EXCEL_COLORS.title } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = thinBorder();
      if (options?.zebra && (r - fromRow) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.altRow } };
      }
    });
  }
}

export function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

export function autoFitColumns(sheet: ExcelJS.Worksheet, min = 8, max = 48): void {
  sheet.columns.forEach((column) => {
    let maxLen = min;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const text =
        cell.value == null
          ? ''
          : typeof cell.value === 'object' && 'text' in (cell.value as object)
            ? String((cell.value as { text: string }).text)
            : String(cell.value);
      maxLen = Math.max(maxLen, Math.min(max, text.length + 2));
    });
    column.width = maxLen;
  });
}

export function freezePane(sheet: ExcelJS.Worksheet, row: number, col = 1): void {
  sheet.views = [{ state: 'frozen', ySplit: row, xSplit: col - 1, activeCell: `A${row + 1}` }];
}

export function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): void {
  void workbook.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

export async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function defaultExportFilename(prefix: string): string {
  return `${prefix}_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: es })}.xlsx`;
}

export async function runExcelExport(
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  const toastId = 'excel-export';
  try {
    toast.loading(`Generando ${label}...`, { id: toastId });
    await fn();
    toast.success(`${label} descargado correctamente`, { id: toastId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`Excel export (${label}):`, error);
    toast.error(`No se pudo generar ${label}: ${message}`, { id: toastId });
  }
}

export async function addDataSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  columnWidths?: number[]
): Promise<ExcelJS.Worksheet> {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  const tableStart = await addBrandedExcelHeader(
    workbook,
    sheet,
    title,
    subtitle,
    Math.max(headers.length, 6)
  );
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  rows.forEach((values) => sheet.addRow(values));

  const lastRow = tableStart + rows.length;
  if (rows.length > 0) {
    styleDataRows(sheet, tableStart + 1, lastRow, { zebra: true });
  }
  freezePane(sheet, tableStart);

  if (columnWidths?.length) {
    setColumnWidths(sheet, columnWidths);
  } else {
    autoFitColumns(sheet);
  }

  const centerRow = tableStart + Math.max(3, Math.floor(rows.length / 2) + 2);
  await addExcelWatermark(workbook, sheet, {
    mergeCols: Math.max(headers.length, 6),
    centerRow,
  });

  return sheet;
}
