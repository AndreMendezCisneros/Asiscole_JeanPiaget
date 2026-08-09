import ExcelJS from 'exceljs';

export type PensionExcelParsedRow = {
  rowIndex: number;
  rawDni: string | null;
  rawNombre: string | null;
  monto: number | null;
  fechaPago: string | null;
};

export type PensionExcelParseResult = {
  headers: string[];
  headerRowIndex: number;
  rows: PensionExcelParsedRow[];
};

const ID_KEYS = [
  'dni',
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

function classifyHeader(h: string): 'id' | 'nombre' | 'monto' | 'fecha' | null {
  if (!h) return null;
  if (ID_KEYS.some((k) => h === k || h.includes(k))) return 'id';
  if (NAME_KEYS.some((k) => h === k || h.includes(k))) return 'nombre';
  // Fecha antes que monto: "fecha pago" no debe clasificarse como monto
  if (FECHA_KEYS.some((k) => h === k || h.includes(k))) return 'fecha';
  if (MONTO_KEYS.some((k) => h === k || h.includes(k))) return 'monto';
  return null;
}

function cellToString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: unknown }).text ?? '').trim() || null;
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

export async function parsePensionesExcelBuffer(
  buffer: ArrayBuffer | ExcelJS.Buffer,
): Promise<PensionExcelParseResult> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS tipa Buffer de Node; en browser es ArrayBuffer
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { headers: [], headerRowIndex: -1, rows: [] };
  }

  let headerRowIndex = -1;
  let colMap: Partial<Record<'id' | 'nombre' | 'monto' | 'fecha', number>> = {};
  const headers: string[] = [];

  ws.eachRow((row, rowNumber) => {
    if (headerRowIndex >= 0) return;
    const values = (row.values as unknown[]) || [];
    const cells = values.slice(1).map((v) => foldHeader(cellToString(v) ?? v));
    const kinds = cells.map(classifyHeader);
    const recognized = kinds.filter(Boolean).length;
    if (recognized < 2) return;

    headerRowIndex = rowNumber;
    cells.forEach((h, i) => {
      headers.push(h);
      const kind = kinds[i];
      if (kind && colMap[kind] == null) colMap[kind] = i + 1;
    });
  });

  if (headerRowIndex < 0) {
    return { headers: [], headerRowIndex: -1, rows: [] };
  }

  const rows: PensionExcelParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;
    const rawDni = colMap.id != null ? cellToString(row.getCell(colMap.id).value) : null;
    const rawNombre =
      colMap.nombre != null ? cellToString(row.getCell(colMap.nombre).value) : null;
    const monto = colMap.monto != null ? cellToMonto(row.getCell(colMap.monto).value) : null;
    const fechaPago =
      colMap.fecha != null ? cellToFecha(row.getCell(colMap.fecha).value) : null;

    if (!rawDni && !rawNombre) return;
    rows.push({ rowIndex: rowNumber, rawDni, rawNombre, monto, fechaPago });
  });

  return { headers, headerRowIndex, rows };
}

export const PENSIONES_EXCEL_MAX_BYTES = 8 * 1024 * 1024;
