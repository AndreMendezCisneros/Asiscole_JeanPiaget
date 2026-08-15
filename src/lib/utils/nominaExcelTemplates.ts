import ExcelJS from 'exceljs';
import type { Student } from '@/types';
import type { NotasDeclaracion } from '@/types/notas';
import { sortNominaByName } from '@/lib/utils/loadActiveNomina';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function styleHeader(ws: ExcelJS.Worksheet, widths: number[]) {
  ws.getRow(1).font = { bold: true };
  ws.columns = widths.map((width) => ({ width }));
}

/** Plantilla de pensiones: DNI, Nombre, Monto, Fecha. */
export async function downloadPensionesNominaTemplate(
  students: Student[],
  options?: { montoMensual?: number | null; filename?: string },
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Pensiones');
  ws.addRow(['DNI', 'Nombre', 'Monto', 'Fecha']);
  for (const student of sortNominaByName(students)) {
    ws.addRow([student.barcode, student.fullName, options?.montoMensual ?? '', '']);
  }
  styleHeader(ws, [14, 40, 12, 14]);
  await downloadWorkbook(wb, options?.filename ?? 'plantilla_pensiones.xlsx');
}

/** Plantilla de declaraciones: DNI, Nombre, Carrera, Área (sin nota). */
export async function downloadDeclaracionesNominaTemplate(
  students: Student[],
  options?: {
    declaraciones?: NotasDeclaracion[];
    filename?: string;
  },
) {
  const byStudent = new Map(
    (options?.declaraciones ?? []).map((d) => [d.idEstudiante, d] as const),
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Declaraciones');
  ws.addRow(['DNI', 'Nombre', 'Carrera', 'Área']);
  for (const student of sortNominaByName(students)) {
    const decl = byStudent.get(student.id);
    ws.addRow([
      student.barcode,
      student.fullName,
      decl?.carreraNombre ?? '',
      decl?.areaNombre ?? '',
    ]);
  }
  styleHeader(ws, [14, 40, 40, 18]);
  await downloadWorkbook(wb, options?.filename ?? 'plantilla_declaraciones_carrera.xlsx');
}

/** Plantilla de importar notas: incluye columna Nota (0–20). */
export async function downloadNotasImportNominaTemplate(
  students: Student[],
  options?: {
    declaraciones?: NotasDeclaracion[];
    filename?: string;
  },
) {
  const byStudent = new Map(
    (options?.declaraciones ?? []).map((d) => [d.idEstudiante, d] as const),
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Notas');
  ws.addRow(['DNI', 'Nombre', 'Nota', 'Carrera', 'Área', 'Observación']);
  for (const student of sortNominaByName(students)) {
    const decl = byStudent.get(student.id);
    ws.addRow([
      student.barcode,
      student.fullName,
      '',
      decl?.carreraNombre ?? '',
      decl?.areaNombre ?? '',
      '',
    ]);
  }
  styleHeader(ws, [14, 40, 10, 40, 18, 24]);
  await downloadWorkbook(wb, options?.filename ?? 'plantilla_notas.xlsx');
}
