import ExcelJS from 'exceljs';
import type { NotasRankingArea, NotasRow } from '@/types/notas';

export async function buildNotasRankingExcelBuffer(
  semanaEtiqueta: string,
  porArea: NotasRankingArea[],
  listado: NotasRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Asis Academy';

  for (const area of [...porArea].sort((a, b) => a.orden - b.orden)) {
    const ws = wb.addWorksheet(area.areaNombre.slice(0, 31));
    ws.addRow(['Semana', semanaEtiqueta]);
    ws.addRow(['Área', area.areaNombre]);
    ws.addRow([]);
    ws.addRow(['Puesto', 'DNI', 'Nombre', 'Nota']);
    const rows = listado
      .filter((n) => n.areaId === area.areaId)
      .sort((a, b) => b.nota - a.nota || a.nombreEstudiante.localeCompare(b.nombreEstudiante));
    rows.forEach((r, i) => {
      ws.addRow([i + 1, r.barcode, r.nombreEstudiante, Number(r.nota)]);
    });
  }

  const rank = wb.addWorksheet('Ranking');
  rank.addRow(['Semana', semanaEtiqueta]);
  rank.addRow([]);
  rank.addRow(['Área', 'Puesto', 'DNI', 'Nombre', 'Nota']);
  for (const area of porArea) {
    for (const t of area.top) {
      rank.addRow([area.areaNombre, t.puesto, t.barcode, t.nombreEstudiante, Number(t.nota)]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export function buildNotasRankingPdfHtml(semanaEtiqueta: string, porArea: NotasRankingArea[]): string {
  const sections = porArea
    .map((a) => {
      const mayor = a.top[0];
      const rows = a.top
        .map(
          (t) =>
            `<tr><td>${t.puesto}</td><td>${t.barcode}</td><td>${t.nombreEstudiante}</td><td>${t.nota}</td></tr>`,
        )
        .join('');
      return `
        <h2>${a.areaNombre}</h2>
        <p><strong>Mayor puntaje:</strong> ${
          mayor ? `${mayor.nombreEstudiante} (${mayor.nota})` : '—'
        }</p>
        <table border="1" cellpadding="4" cellspacing="0" width="100%">
          <thead><tr><th>Puesto</th><th>DNI</th><th>Nombre</th><th>Nota</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Sin notas</td></tr>'}</tbody>
        </table>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Ranking notas</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px} h1{font-size:20px} h2{font-size:16px;margin-top:24px}</style>
    </head><body>
    <h1>Ranking de notas — ${semanaEtiqueta}</h1>
    ${sections}
    </body></html>`;
}
