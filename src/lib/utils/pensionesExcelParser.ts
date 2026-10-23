import ExcelJS from 'exceljs';

export type PensionExcelFormato = 'matriz' | 'plano';

export type PensionExcelParsedRow = {
  rowIndex: number;
  rawDni: string | null;
  rawNombre: string | null;
  monto: number | null;
  fechaPago: string | null;
  /** Meses (1-12) con celda DEBE. Vacío en el formato plano. */
  mesesDebe: number[];
};

export type PensionExcelParseResult = {
  formato: PensionExcelFormato;
  headers: string[];
  headerRowIndex: number;
  /** Meses (1-12) que el archivo trae como columna. */
  mesesCubiertos: number[];
  /** Año leído del título del reporte, si existe. */
  anioTitulo: number | null;
  rows: PensionExcelParsedRow[];
};

const ID_KEYS = [
  'dni',
  'doc alu',
  'documento',
  'codigo',
  'código',
  'carnet',
  'codigo_barras',
  'codigobarras',
  'nro documento',
  'nrodocumento',
  'nro. documento',
];

/** Orden del año escolar en el reporte de deudas. */
export const PENSION_MONTH_COLUMNS: Array<{ month: number; names: string[]; short: string }> = [
  { month: 3, names: ['marzo'], short: 'Mar' },
  { month: 4, names: ['abril'], short: 'Abr' },
  { month: 5, names: ['mayo'], short: 'May' },
  { month: 6, names: ['junio'], short: 'Jun' },
  { month: 7, names: ['julio'], short: 'Jul' },
  { month: 8, names: ['agosto'], short: 'Ago' },
  { month: 9, names: ['setiembre', 'septiembre'], short: 'Set' },
  { month: 10, names: ['octubre'], short: 'Oct' },
  { month: 11, names: ['noviembre'], short: 'Nov' },
  { month: 12, names: ['diciembre'], short: 'Dic' },
];

export function pensionMonthShort(month: number): string {
  return PENSION_MONTH_COLUMNS.find((m) => m.month === month)?.short ?? String(month);
}
const NAME_KEYS = [
  'nombre',
  'apellidos',
  'alumno',
  'estudiante',
  'nombre completo',
  'nombrecompleto',
  'apellidos y nombres',
];
const MONTO_KEYS = ['monto', 'importe', 'monto pagado', 'soles', 'monto pag.'];
const FECHA_KEYS = ['fecha', 'fecha pago', 'fecha de pago', 'fechapago'];

function foldHeader(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function monthFromHeader(h: string): number | null {
  if (!h) return null;
  const hit = PENSION_MONTH_COLUMNS.find((m) => m.names.some((name) => h === name));
  return hit?.month ?? null;
}

function classifyHeader(h: string): 'id' | 'nombre' | 'monto' | 'fecha' | null {
  if (!h || monthFromHeader(h)) return null;
  // "cod alu" no es el DNI; "doc alu" sí.
  if (h === 'cod alu' || h.startsWith('cod ')) return null;
  if (ID_KEYS.some((k) => h === k || h.includes(k))) return 'id';
  if (NAME_KEYS.some((k) => h === k || h.includes(k))) return 'nombre';
  // Fecha antes que monto: "fecha pago" no debe clasificarse como monto
  if (FECHA_KEYS.some((k) => h === k || h.includes(k))) return 'fecha';
  if (MONTO_KEYS.some((k) => h === k || h.includes(k))) return 'monto';
  return null;
}

function cellToString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText?: Array<{ text?: string }> }).richText ?? [];
    const text = parts.map((p) => p.text ?? '').join('').trim();
    return text || null;
  }
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: unknown }).text ?? '').trim() || null;
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return cellToString((value as { result: unknown }).result);
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).trim() || null;
}

function cellToMonto(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function cellToFecha(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return null;
}

function dniDigits(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 6 ? digits : null;
}

function cellIsDebe(value: unknown): boolean {
  const text = foldHeader(cellToString(value) ?? '');
  return text === 'debe' || text.startsWith('debe ');
}

function yearFromSheet(ws: ExcelJS.Worksheet, beforeRow: number): number | null {
  let found: number | null = null;
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= beforeRow || found) return;
    const values = (row.values as unknown[]) || [];
    const blob = values.map((v) => cellToString(v) ?? '').join(' ');
    const match = blob.match(/\b(20\d{2})\b/);
    if (match) found = Number(match[1]);
  });
  return found;
}

export async function parsePensionesExcelBuffer(
  buffer: ArrayBuffer | ExcelJS.Buffer,
): Promise<PensionExcelParseResult> {
  const empty: PensionExcelParseResult = {
    formato: 'plano',
    headers: [],
    headerRowIndex: -1,
    mesesCubiertos: [],
    anioTitulo: null,
    rows: [],
  };
  const wb = new ExcelJS.Workbook();
  // ExcelJS tipa Buffer de Node; en browser es ArrayBuffer
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return empty;

  let headerRowIndex = -1;
  let colMap: Partial<Record<'id' | 'nombre' | 'monto' | 'fecha', number>> = {};
  const monthCols: Array<{ month: number; col: number }> = [];
  const headers: string[] = [];

  ws.eachRow((row, rowNumber) => {
    if (headerRowIndex >= 0) return;
    const values = (row.values as unknown[]) || [];
    const cells = values.slice(1).map((v) => foldHeader(cellToString(v) ?? v));
    const kinds = cells.map(classifyHeader);
    const months = cells.map(monthFromHeader);
    const hasId = kinds.includes('id');
    const hasNombre = kinds.includes('nombre');
    const monthCount = months.filter((m) => m != null).length;
    // El título "alumnos deudores" no es encabezado: hace falta la columna de DNI
    // o, en el reporte de deudas, las columnas de mes.
    const looksMatrix = monthCount >= 2 && (hasId || hasNombre);
    const looksFlat = hasId && hasNombre && monthCount < 2;
    if (!looksMatrix && !looksFlat) return;

    headerRowIndex = rowNumber;
    cells.forEach((h, i) => {
      headers.push(h);
      const month = months[i];
      if (month != null) {
        monthCols.push({ month, col: i + 1 });
        return;
      }
      const kind = kinds[i];
      if (kind && colMap[kind] == null) colMap[kind] = i + 1;
    });
  });

  if (headerRowIndex < 0) return empty;

  const formato: PensionExcelFormato = monthCols.length >= 2 ? 'matriz' : 'plano';
  const rows: PensionExcelParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;
    const rawDni = colMap.id != null ? cellToString(row.getCell(colMap.id).value) : null;
    const rawNombre =
      colMap.nombre != null ? cellToString(row.getCell(colMap.nombre).value) : null;
    if (formato === 'matriz' && !dniDigits(rawDni)) return;

    const monto = colMap.monto != null ? cellToMonto(row.getCell(colMap.monto).value) : null;
    const fechaPago =
      colMap.fecha != null ? cellToFecha(row.getCell(colMap.fecha).value) : null;
    const mesesDebe =
      formato === 'matriz'
        ? monthCols
            .filter((m) => cellIsDebe(row.getCell(m.col).value))
            .map((m) => m.month)
        : [];

    if (!rawDni && !rawNombre) return;
    rows.push({ rowIndex: rowNumber, rawDni, rawNombre, monto, fechaPago, mesesDebe });
  });

  return {
    formato,
    headers,
    headerRowIndex,
    mesesCubiertos: monthCols.map((m) => m.month),
    anioTitulo: formato === 'matriz' ? yearFromSheet(ws, headerRowIndex) : null,
    rows,
  };
}

export const PENSIONES_EXCEL_MAX_BYTES = 8 * 1024 * 1024;
