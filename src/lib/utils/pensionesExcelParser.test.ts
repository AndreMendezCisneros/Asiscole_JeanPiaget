import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePensionesExcelBuffer, pensionMonthShort } from './pensionesExcelParser';

describe('parsePensionesExcelBuffer reporte de deudas', () => {
  it('lee DNI, nombre y meses DEBE, e ignora filas de salón', async () => {
    const file = resolve(process.cwd(), '..', 'REPORTE DE PENSIONES 23-10-26.xlsx');
    const buffer = readFileSync(file);
    const parsed = await parsePensionesExcelBuffer(buffer);

    expect(parsed.formato).toBe('matriz');
    expect(parsed.anioTitulo).toBe(2026);
    expect(parsed.mesesCubiertos).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(parsed.rows.length).toBeGreaterThan(10);
    expect(parsed.rows.every((r) => (r.rawDni || '').replace(/\D/g, '').length >= 6)).toBe(true);

    const sebastian = parsed.rows.find((r) => r.rawDni === '93390126');
    expect(sebastian?.mesesDebe).toEqual([9]);
    const varios = parsed.rows.find((r) => r.mesesDebe.length > 1);
    expect(varios).toBeTruthy();
    expect(pensionMonthShort(9)).toBe('Set');
  });
});