import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  categoryFromGroupTitle,
  isImportableRow,
  normalizeDni,
  parsePersonalExcelBuffer,
} from './personalExcelParser';

const FILE = resolve(process.cwd(), 'CONTRO DE ASISTENCIA 2026 (1).xlsx');

describe('personalExcelParser helpers', () => {
  it('completa los ceros perdidos del DNI', () => {
    expect(normalizeDni('6182146')).toBe('06182146');
    expect(normalizeDni('28571627')).toBe('28571627');
    expect(normalizeDni(null)).toBeNull();
    expect(normalizeDni('123')).toBeNull();
  });

  it('reconoce los títulos de grupo', () => {
    expect(categoryFromGroupTitle('EQUIPO DIRECTIVO Y JERÁRQUICO')).toBe('Directivo y Jerárquico');
    expect(categoryFromGroupTitle('PERSONAL DOCENTE Y AUXILIARES DE INICIAL')).toBe('Docente Inicial');
    expect(categoryFromGroupTitle('PERSONAL DE SERVICIO Y MANTENIMIENTO')).toBe('Servicio y Mantenimiento');
    expect(categoryFromGroupTitle('DIRECTORIO')).toBeNull();
  });
});

describe.skipIf(!existsSync(FILE))('parsePersonalExcelBuffer con el directorio real', () => {
  it('lee las 65 personas en 6 grupos y marca los problemas', async () => {
    const { rows, warnings } = await parsePersonalExcelBuffer(readFileSync(FILE));
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(65);
    expect(new Set(rows.map((r) => r.category)).size).toBe(6);
    expect(rows[0].category).toBe('Directivo y Jerárquico');
    expect(rows[rows.length - 1].category).toBe('Servicio y Mantenimiento');

    const sinDni = rows.filter((r) => !r.dni);
    expect(sinDni.map((r) => r.fullName)).toEqual([expect.stringMatching(/NAJARRO/)]);

    const repetidos = rows.filter((r) => r.dni === '70457422');
    expect(repetidos).toHaveLength(2);
    expect(repetidos.every((r) => !isImportableRow(r))).toBe(true);

    expect(rows.find((r) => r.dni === '06182146')).toBeTruthy();
    expect(rows.filter(isImportableRow)).toHaveLength(62);
  });
});
