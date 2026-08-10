import ExcelJS from 'exceljs';

export type NotasExcelParsedRow = {
  rowIndex: number;
  rawDni: string | null;
  rawNombre: string | null;
  nota: number | null;
  observacion: string | null;
  /** Carrera / especialidad del Excel (texto libre). */
  carreraNombre: string | null;
  /** Área académica: código (salud|ingenierias|letras) o nombre. */
  areaCodigo: string | null;
};

export type NotasExcelParseResult = {
  headers: string[];
  headerRowIndex: number;
  rows: NotasExcelParsedRow[];
};

const ID_KEYS = [
  'dni',
  'documento',
  'codigo',
  'código',
  'carnet',
  'codigo_barras',
  'codigobarras',
];
const NAME_KEYS = ['nombre', 'apellidos', 'alumno', 'estudiante', 'nombre completo'];
const NOTA_KEYS = ['nota', 'calificacion', 'calificación', 'puntaje', 'puntos'];
const OBS_KEYS = ['observacion', 'observación', 'obs', 'comentario'];
const CARRERA_KEYS = ['carrera', 'especialidad', 'programa', 'vocacional'];
const AREA_KEYS = ['area', 'área', 'area academica', 'área académica', 'area codigo', 'área código'];

type ColKind = 'id' | 'nombre' | 'nota' | 'obs' | 'carrera' | 'area';

function foldHeader(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyHeader(h: string): ColKind | null {
  if (!h) return null;
  // Carrera/área antes que "nombre" (p. ej. "carrera nombre").
  if (CARRERA_KEYS.some((k) => h === k || h.includes(k))) return 'carrera';
  if (AREA_KEYS.some((k) => h === k || h.includes(k))) return 'area';
  if (ID_KEYS.some((k) => h === k || h.includes(k))) return 'id';
  if (NAME_KEYS.some((k) => h === k || h.includes(k))) return 'nombre';
  if (NOTA_KEYS.some((k) => h === k || h.includes(k))) return 'nota';
  if (OBS_KEYS.some((k) => h === k || h.includes(k))) return 'obs';
  return null;
}

function cellToString(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: unknown }).text ?? '').trim() || null;
  }
  return String(value).trim() || null;
}

function cellToNota(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export async function parseNotasExcelBuffer(
  buffer: ArrayBuffer | ExcelJS.Buffer,
): Promise<NotasExcelParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], headerRowIndex: -1, rows: [] };

  let headerRowIndex = -1;
  let colMap: Partial<Record<ColKind, number>> = {};
  const headers: string[] = [];

  ws.eachRow((row, rowNumber) => {
    if (headerRowIndex >= 0) return;
    const values = (row.values as unknown[]) || [];
    const cells = values.slice(1).map((v) => foldHeader(cellToString(v) ?? v));
    const kinds = cells.map(classifyHeader);
    if (kinds.filter(Boolean).length < 2) return;
    headerRowIndex = rowNumber;
    cells.forEach((h, i) => {
      headers.push(h);
      const kind = kinds[i];
      if (kind && colMap[kind] == null) colMap[kind] = i + 1;
    });
  });

  if (headerRowIndex < 0) return { headers: [], headerRowIndex: -1, rows: [] };

  const rows: NotasExcelParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;
    const rawDni = colMap.id != null ? cellToString(row.getCell(colMap.id).value) : null;
    const rawNombre =
      colMap.nombre != null ? cellToString(row.getCell(colMap.nombre).value) : null;
    const nota = colMap.nota != null ? cellToNota(row.getCell(colMap.nota).value) : null;
    const observacion =
      colMap.obs != null ? cellToString(row.getCell(colMap.obs).value) : null;
    const carreraNombre =
      colMap.carrera != null ? cellToString(row.getCell(colMap.carrera).value) : null;
    const areaCodigo =
      colMap.area != null ? cellToString(row.getCell(colMap.area).value) : null;
    if (!rawDni && !rawNombre) return;
    rows.push({
      rowIndex: rowNumber,
      rawDni,
      rawNombre,
      nota,
      observacion,
      carreraNombre,
      areaCodigo,
    });
  });

  return { headers, headerRowIndex, rows };
}

export const NOTAS_EXCEL_MAX_BYTES = 8 * 1024 * 1024;

export function isNotaValida(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 20;
}
