import ExcelJS from 'exceljs';
import { cellToString, foldHeader } from './pensionesExcelParser';
import type { PersonalCategoria } from '@/types/personal';

/**
 * Lee el "Directorio del personal" (Excel del colegio):
 * cabecera Nº | APELLIDOS Y NOMBRES | FECHA DE NACIMIENTO | DNI | DIRECCIÓN,
 * con filas de grupo (EQUIPO DIRECTIVO…, PERSONAL ADMINISTRATIVO…) que dan la categoría.
 */

export type PersonalExcelRow = {
  rowIndex: number;
  fullName: string;
  /** DNI de 8 dígitos (se completan ceros perdidos por Excel), o null si no trae. */
  dni: string | null;
  birthDate: string | null;
  address: string | null;
  category: PersonalCategoria;
  issues: string[];
};

export type PersonalExcelParseResult = {
  rows: PersonalExcelRow[];
  /** Filas que no se pudieron ubicar en una categoría. */
  warnings: string[];
};

const CATEGORY_RULES: Array<{ match: string[]; category: PersonalCategoria }> = [
  { match: ['directivo', 'jerarquico'], category: 'Directivo y Jerárquico' },
  { match: ['administrativo'], category: 'Administrativo' },
  { match: ['inicial'], category: 'Docente Inicial' },
  { match: ['primaria'], category: 'Docente Primaria' },
  { match: ['secundaria'], category: 'Docente Secundaria' },
  { match: ['servicio', 'mantenimiento'], category: 'Servicio y Mantenimiento' },
];

export function categoryFromGroupTitle(raw: string): PersonalCategoria | null {
  const h = foldHeader(raw);
  return CATEGORY_RULES.find((r) => r.match.some((m) => h.includes(m)))?.category ?? null;
}

/** "6182146" → "06182146". Devuelve null si no parece DNI. */
export function normalizeDni(raw: string | null): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 8) return null;
  return digits.padStart(8, '0');
}

type Columns = { num: number; name: number; birth: number; dni: number; address: number };

function findHeader(sheet: ExcelJS.Worksheet): { rowIndex: number; cols: Columns } | null {
  for (let r = 1; r <= Math.min(sheet.rowCount, 15); r++) {
    const row = sheet.getRow(r);
    const cols: Partial<Columns> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = foldHeader(cellToString(cell.value));
      if (h === 'n' || h === 'no' || h.startsWith('n°') || h === 'nº' || h === 'item') cols.num = col;
      else if (h.includes('apellidos') || h.includes('nombre')) cols.name = col;
      else if (h.includes('nacimiento')) cols.birth = col;
      else if (h === 'dni' || h.includes('documento')) cols.dni = col;
      else if (h.includes('direccion')) cols.address = col;
    });
    if (cols.name && cols.dni) {
      return {
        rowIndex: r,
        cols: {
          num: cols.num ?? cols.name - 1,
          name: cols.name,
          birth: cols.birth ?? -1,
          dni: cols.dni,
          address: cols.address ?? -1,
        },
      };
    }
  }
  return null;
}

export async function parsePersonalExcelBuffer(
  buffer: ArrayBuffer | Uint8Array,
): Promise<PersonalExcelParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('El archivo no tiene hojas.');

  const header = findHeader(sheet);
  if (!header) {
    throw new Error('No se encontró la cabecera (APELLIDOS Y NOMBRES / DNI).');
  }
  const { cols } = header;
  const read = (row: ExcelJS.Row, col: number) => (col > 0 ? cellToString(row.getCell(col).value) : null);

  const rows: PersonalExcelRow[] = [];
  const warnings: string[] = [];
  let category: PersonalCategoria | null = null;

  for (let r = header.rowIndex + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const num = read(row, cols.num);
    const name = read(row, cols.name);
    const isNumbered = num != null && /^\d+$/.test(num);

    if (!isNumbered) {
      // Fila de grupo: el título puede estar en cualquier celda (suele ir combinada).
      const texts: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const t = cellToString(cell.value);
        if (t) texts.push(t);
      });
      const title = texts.join(' ');
      if (title) {
        const next = categoryFromGroupTitle(title);
        if (next) category = next;
      }
      continue;
    }
    if (!name) continue;

    if (!category) {
      warnings.push(`Fila ${r}: ${name} no está bajo ningún grupo; se omite.`);
      continue;
    }

    const rawDni = read(row, cols.dni);
    const dni = normalizeDni(rawDni);
    const issues: string[] = [];
    if (!rawDni) issues.push('Sin DNI');
    else if (!dni) issues.push(`DNI inválido (${rawDni})`);
    else if (rawDni.replace(/\D/g, '').length < 8) issues.push(`DNI completado con ceros (${rawDni} → ${dni})`);

    const birth = read(row, cols.birth);
    rows.push({
      rowIndex: r,
      fullName: name.replace(/\s+/g, ' ').trim(),
      dni,
      birthDate: birth && /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
      address: read(row, cols.address),
      category,
      issues,
    });
  }

  const byDni = new Map<string, PersonalExcelRow[]>();
  for (const row of rows) {
    if (!row.dni) continue;
    byDni.set(row.dni, [...(byDni.get(row.dni) ?? []), row]);
  }
  for (const [dni, dupes] of byDni) {
    if (dupes.length < 2) continue;
    for (const row of dupes) {
      const others = dupes.filter((d) => d !== row).map((d) => d.fullName).join(', ');
      row.issues.push(`DNI ${dni} repetido con ${others}`);
    }
  }

  return { rows, warnings };
}

/** Una fila se puede importar si tiene DNI válido y no está repetido. */
export function isImportableRow(row: PersonalExcelRow): boolean {
  return Boolean(row.dni) && !row.issues.some((i) => i.startsWith('DNI ') && i.includes('repetido'));
}
