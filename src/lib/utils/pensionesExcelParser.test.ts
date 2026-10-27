import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parsePensionesExcelBuffer, pensionMonthShort } from './pensionesExcelParser';

const HEADER = [
  null,
  'Cod. Alu',
  'Apellidos y Nombres',
  'Doc. Alu.',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
];

/** Formato SIEWEB del 27/10: encabezado repetido por salón y "DEBE " con espacio. */
async function buildReporte(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.addRow([null, 'Colegio Jean Piaget']);
  ws.addRow([null, 'SIEWEB Tesorería']);
  ws.addRow([null, ' ALUMNOS PENDIENTES DE  DEUDAS -  2026']);
  ws.addRow([null, ' AL  27/10/2026']);
  ws.addRow(HEADER);
  ws.addRow([null, 'Inicial', ': AMARILLO']);
  ws.addRow([null, '20260103', 'GUILLEN EGUIZABAL, SEBASTIAN ', '93390126', null, null, null, null, null, null, 'DEBE ']);
  ws.addRow([null, null, 'Cant.: 1']);
  ws.addRow([]);
  ws.addRow(HEADER);
  ws.addRow([null, 'Primaria', ': Primaria Primer Grado "A"']);
  ws.addRow([null, '20230171', 'CORDOVA YARANGA, TEO ADRIAN', '91636629', null, null, null, 'DEBE', 'DEBE ', 'DEBE', 'DEBE']);
  ws.addRow([null, null, 'Cant.: 1']);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

describe('parsePensionesExcelBuffer reporte de deudas', () => {
  it('lee DNI, nombre y meses DEBE, e ignora filas de salón y encabezados repetidos', async () => {
    const parsed = await parsePensionesExcelBuffer(await buildReporte());

    expect(parsed.formato).toBe('matriz');
    expect(parsed.anioTitulo).toBe(2026);
    expect(parsed.mesesCubiertos).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(parsed.rows.map((r) => r.rawDni)).toEqual(['93390126', '91636629']);

    const sebastian = parsed.rows.find((r) => r.rawDni === '93390126');
    expect(sebastian?.mesesDebe).toEqual([9]);
    const teo = parsed.rows.find((r) => r.rawDni === '91636629');
    expect(teo?.mesesDebe).toEqual([6, 7, 8, 9]);
    expect(pensionMonthShort(9)).toBe('Set');
  });
});
