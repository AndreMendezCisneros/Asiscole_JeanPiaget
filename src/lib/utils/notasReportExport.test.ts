import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildNotasRankingExcelBuffer,
  buildNotasRankingPdfHtml,
} from './notasReportExport';
import type { NotasRankingArea, NotasRow } from '@/types/notas';

const porArea: NotasRankingArea[] = [
  {
    areaId: 1,
    areaCodigo: 'salud',
    areaNombre: 'Salud',
    orden: 1,
    top: [
      {
        idEstudiante: 1,
        nombreEstudiante: 'Ana',
        barcode: '1',
        nota: 19,
        puesto: 1,
      },
    ],
  },
  {
    areaId: 2,
    areaCodigo: 'ing',
    areaNombre: 'Ingenierías',
    orden: 2,
    top: [],
  },
  {
    areaId: 3,
    areaCodigo: 'letras',
    areaNombre: 'Letras',
    orden: 3,
    top: [
      {
        idEstudiante: 2,
        nombreEstudiante: 'Luis',
        barcode: '2',
        nota: 17,
        puesto: 1,
      },
    ],
  },
];

const listado: NotasRow[] = [
  {
    id: 1,
    idEstudiante: 1,
    nombreEstudiante: 'Ana',
    barcode: '1',
    semanaId: 1,
    areaId: 1,
    areaNombre: 'Salud',
    carreraId: null,
    carreraNombre: 'Medicina Humana',
    nota: 19,
    observacion: null,
    registradoEn: '',
  },
  {
    id: 2,
    idEstudiante: 2,
    nombreEstudiante: 'Luis',
    barcode: '2',
    semanaId: 1,
    areaId: 3,
    areaNombre: 'Letras',
    carreraId: null,
    carreraNombre: null,
    nota: 17,
    observacion: null,
    registradoEn: '',
  },
];

describe('notasReportExport', () => {
  it('genera Excel profesional con Resumen, áreas, Ranking top y Listado', async () => {
    const buf = await buildNotasRankingExcelBuffer('Semana demo', porArea, listado, {
      escuela: 'Asis Academy',
      semanaCodigo: '2026-01',
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buf) as unknown as ExcelJS.Buffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toContain('Resumen');
    expect(names.some((n) => /Salud/i.test(n))).toBe(true);
    expect(names.some((n) => /Ingenier/i.test(n))).toBe(true);
    expect(names.some((n) => /Letras/i.test(n))).toBe(true);
    expect(names).toContain('Ranking top');
    expect(names).toContain('Listado completo');
  });

  it('genera HTML de PDF con branding', () => {
    const html = buildNotasRankingPdfHtml('Semana demo', porArea, {
      escuela: 'Asis Academy',
    });
    expect(html).toContain('Mayor:');
    expect(html).toContain('Ana');
    expect(html).toContain('Asis Academy');
    expect(html).toContain('Ranking de notas por área');
  });
});
