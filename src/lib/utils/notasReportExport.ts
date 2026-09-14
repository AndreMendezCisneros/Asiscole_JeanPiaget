import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotasRankingArea, NotasRow } from '@/types/notas';
import { PdfReportDocument } from '@/lib/utils/pdfReportBuilder';
import { getRoundedReportLogoBuffer } from '@/lib/utils/reportLogo';

const PRIMARY = 'FF1E4A7A';
const ZEBRA = 'FFF1F5F9';
const GOLD = 'FFFEF3C7';
const SILVER = 'FFE2E8F0';
const BRONZE = 'FFFED7AA';
const BORDER = 'FFCBD5E1';
const MUTED = 'FF64748B';
const INK = 'FF0F172A';

export type NotasReportMeta = {
  escuela?: string;
  semanaCodigo?: string;
  generadoEn?: Date;
};

function schoolName(meta?: NotasReportMeta): string {
  return (
    meta?.escuela?.trim() ||
    (import.meta.env.VITE_SCHOOL_NAME as string | undefined)?.trim() ||
    'Academia Sofía'
  );
}

function sheetSafeName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Area';
}

function fillSolid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge = { style: 'thin' as const, color: { argb: BORDER } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function setCell(
  ws: ExcelJS.Worksheet,
  r: number,
  c: number,
  value: ExcelJS.CellValue,
  style?: {
    font?: Partial<ExcelJS.Font>;
    alignment?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  },
) {
  const cell = ws.getCell(r, c);
  cell.value = value;
  if (style?.font) cell.font = { name: 'Calibri', size: 10, ...style.font };
  if (style?.alignment) cell.alignment = { ...style.alignment };
  if (style?.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

function paintHeader(ws: ExcelJS.Worksheet, r: number, cols: string[]) {
  cols.forEach((label, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = label;
    cell.fill = fillSolid(PRIMARY);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  });
  ws.getRow(r).height = 24;
}

function paintDataRow(
  ws: ExcelJS.Worksheet,
  r: number,
  values: ExcelJS.CellValue[],
  opts?: { medalRank?: number },
) {
  const bg =
    opts?.medalRank === 1
      ? GOLD
      : opts?.medalRank === 2
        ? SILVER
        : opts?.medalRank === 3
          ? BRONZE
          : r % 2 === 0
            ? ZEBRA
            : undefined;

  values.forEach((v, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = v;
    if (bg) cell.fill = fillSolid(bg);
    cell.border = thinBorder();
    cell.font = { size: 10, name: 'Calibri', color: { argb: INK } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: i === 0 || typeof v === 'number' ? 'center' : 'left',
      wrapText: false,
    };
  });
  ws.getRow(r).height = 20;
}

async function addLogo(ws: ExcelJS.Worksheet, wb: ExcelJS.Workbook): Promise<void> {
  try {
    const logo = await getRoundedReportLogoBuffer({ maxWidth: 220, maxHeight: 80 });
    if (!logo) return;
    const id = wb.addImage({
      buffer: logo.buffer as unknown as ExcelJS.Buffer,
      extension: 'png',
    });
    ws.addImage(id, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 140, height: 48 },
      editAs: 'oneCell',
    });
  } catch {
    /* sin logo */
  }
}

function rowsForArea(listado: NotasRow[], areaId: number): NotasRow[] {
  return listado
    .filter((n) => n.areaId === areaId)
    .sort(
      (a, b) =>
        b.nota - a.nota || a.nombreEstudiante.localeCompare(b.nombreEstudiante, 'es'),
    );
}

function avgNota(rows: NotasRow[]): number | null {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + Number(r.nota), 0) / rows.length;
}

function shortArea(name: string): string {
  if (/salud/i.test(name)) return 'Ciencias de la Salud';
  if (/ingenier/i.test(name)) return 'Ingenierías y Exactas';
  if (/letras|sociales/i.test(name)) return 'Letras y Sociales';
  return name.length > 36 ? `${name.slice(0, 34)}…` : name;
}

export async function buildNotasRankingExcelBuffer(
  semanaEtiqueta: string,
  porArea: NotasRankingArea[],
  listado: NotasRow[],
  meta?: NotasReportMeta,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const escuela = schoolName(meta);
  const generado = meta?.generadoEn ?? new Date();
  const generadoTxt = format(generado, "d 'de' MMMM yyyy, HH:mm", { locale: es });

  wb.creator = escuela;
  wb.created = generado;
  wb.title = `Ranking de notas — ${semanaEtiqueta}`;

  const sortedAreas = [...porArea].sort((a, b) => a.orden - b.orden);

  // ——— Resumen ———
  const resumen = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  await addLogo(resumen, wb);

  resumen.getRow(1).height = 52;
  setCell(resumen, 1, 3, `Ranking de notas`, {
    font: { bold: true, size: 18, color: { argb: PRIMARY }, name: 'Calibri' },
    alignment: { vertical: 'middle' },
  });
  setCell(resumen, 2, 3, escuela, {
    font: { size: 12, color: { argb: MUTED }, name: 'Calibri' },
  });

  const metaRows: Array<[string, string]> = [
    ['Periodo', semanaEtiqueta],
    ['Código', meta?.semanaCodigo || '—'],
    ['Generado', generadoTxt],
  ];
  metaRows.forEach(([k, v], i) => {
    const r = 4 + i;
    setCell(resumen, r, 1, k, {
      font: { bold: true, size: 10, color: { argb: MUTED }, name: 'Calibri' },
    });
    setCell(resumen, r, 2, v, {
      font: { size: 10, color: { argb: INK }, name: 'Calibri' },
    });
  });

  let r = 8;
  setCell(resumen, r, 1, 'Indicadores por área', {
    font: { bold: true, size: 12, color: { argb: PRIMARY }, name: 'Calibri' },
  });
  r += 1;

  paintHeader(resumen, r, ['Área', 'Alumnos', 'Promedio', 'Mayor nota', '1.er puesto']);
  r += 1;

  sortedAreas.forEach((area, idx) => {
    const rows = rowsForArea(listado, area.areaId);
    const avg = avgNota(rows);
    const top = rows[0];
    paintDataRow(
      resumen,
      r,
      [
        shortArea(area.areaNombre),
        rows.length,
        avg != null ? Number(avg.toFixed(2)) : '—',
        top ? Number(top.nota) : '—',
        top ? top.nombreEstudiante : '—',
      ],
      { medalRank: undefined },
    );
    const avgCell = resumen.getCell(r, 3);
    if (typeof avgCell.value === 'number') avgCell.numFmt = '0.00';
    const notaCell = resumen.getCell(r, 4);
    if (typeof notaCell.value === 'number') {
      notaCell.numFmt = '0.0';
      notaCell.font = { bold: true, size: 10, name: 'Calibri' };
    }
    resumen.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    resumen.getCell(r, 5).alignment = { vertical: 'middle', horizontal: 'left' };
    if (idx % 2 === 1) {
      for (let c = 1; c <= 5; c++) {
        if (!resumen.getCell(r, c).fill) resumen.getCell(r, c).fill = fillSolid(ZEBRA);
      }
    }
    r += 1;
  });

  r += 1;
  setCell(
    resumen,
    r,
    1,
    'Libro: «Todas las notas» (secciones) · hojas 01/02/03 por área (todos) · «Solo top» (podio). Escala 0–20.',
    { font: { italic: true, size: 9, color: { argb: MUTED }, name: 'Calibri' } },
  );

  resumen.getColumn(1).width = 28;
  resumen.getColumn(2).width = 11;
  resumen.getColumn(3).width = 11;
  resumen.getColumn(4).width = 12;
  resumen.getColumn(5).width = 34;

  // ——— Todas las notas, separadas por sección ———
  const todas = wb.addWorksheet('Todas las notas', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  });
  await addLogo(todas, wb);
  todas.getRow(1).height = 52;
  setCell(todas, 1, 3, 'Todas las notas por sección', {
    font: { bold: true, size: 16, color: { argb: PRIMARY }, name: 'Calibri' },
    alignment: { vertical: 'middle' },
  });
  setCell(todas, 2, 3, `${escuela} · ${semanaEtiqueta} · ${listado.length} registros`, {
    font: { size: 10, color: { argb: MUTED } },
  });

  let tr = 4;
  for (const area of sortedAreas) {
    const rows = rowsForArea(listado, area.areaId);
    const avg = avgNota(rows);

    todas.mergeCells(tr, 1, tr, 6);
    const banner = todas.getCell(tr, 1);
    banner.value = `${shortArea(area.areaNombre)}  ·  ${rows.length} alumno(s)  ·  promedio ${
      avg != null ? avg.toFixed(2) : '—'
    }`;
    banner.fill = fillSolid(PRIMARY);
    banner.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    banner.alignment = { vertical: 'middle', horizontal: 'left' };
    todas.getRow(tr).height = 26;
    tr += 1;

    paintHeader(todas, tr, ['Puesto', 'DNI', 'Nombre completo', 'Carrera', 'Nota', 'Observación']);
    tr += 1;

    if (!rows.length) {
      setCell(todas, tr, 1, 'Sin notas en esta sección.', {
        font: { italic: true, size: 10, color: { argb: MUTED } },
      });
      tr += 2;
      continue;
    }

    rows.forEach((row, i) => {
      paintDataRow(
        todas,
        tr,
        [
          i + 1,
          row.barcode,
          row.nombreEstudiante,
          row.carreraNombre || '—',
          Number(row.nota),
          row.observacion || '',
        ],
        { medalRank: i < 3 ? i + 1 : undefined },
      );
      todas.getCell(tr, 5).numFmt = '0.0';
      todas.getCell(tr, 5).font = { bold: true, size: 10, name: 'Calibri' };
      todas.getCell(tr, 3).alignment = { vertical: 'middle', horizontal: 'left' };
      todas.getCell(tr, 4).alignment = { vertical: 'middle', horizontal: 'left' };
      tr += 1;
    });
    tr += 1;
  }

  todas.getColumn(1).width = 10;
  todas.getColumn(2).width = 14;
  todas.getColumn(3).width = 36;
  todas.getColumn(4).width = 32;
  todas.getColumn(5).width = 10;
  todas.getColumn(6).width = 22;

  // ——— Una hoja completa por área ———
  for (let areaIdx = 0; areaIdx < sortedAreas.length; areaIdx += 1) {
    const area = sortedAreas[areaIdx];
    const label = shortArea(area.areaNombre);
    const ws = wb.addWorksheet(
      sheetSafeName(`${String(areaIdx + 1).padStart(2, '0')} ${label}`),
      { views: [{ state: 'frozen', ySplit: 7, showGridLines: false }] },
    );
    await addLogo(ws, wb);
    ws.getRow(1).height = 52;

    const rows = rowsForArea(listado, area.areaId);
    const avg = avgNota(rows);
    const mayor = rows[0];

    setCell(ws, 1, 3, label, {
      font: { bold: true, size: 16, color: { argb: PRIMARY }, name: 'Calibri' },
      alignment: { vertical: 'middle' },
    });
    setCell(ws, 2, 3, `${escuela} · ${semanaEtiqueta} · listado completo del área`, {
      font: { size: 10, color: { argb: MUTED }, name: 'Calibri' },
    });

    setCell(ws, 4, 1, 'Alumnos', { font: { bold: true, size: 9, color: { argb: MUTED } } });
    setCell(ws, 4, 2, rows.length, { font: { bold: true, size: 12, color: { argb: PRIMARY } } });
    setCell(ws, 4, 3, 'Promedio', { font: { bold: true, size: 9, color: { argb: MUTED } } });
    setCell(ws, 4, 4, avg != null ? Number(avg.toFixed(2)) : '—', {
      font: { bold: true, size: 12, color: { argb: PRIMARY } },
      numFmt: '0.00',
    });
    setCell(ws, 5, 1, 'Mayor', { font: { bold: true, size: 9, color: { argb: MUTED } } });
    setCell(
      ws,
      5,
      2,
      mayor ? `${mayor.nombreEstudiante} (${Number(mayor.nota).toFixed(1)})` : '—',
      { font: { size: 10, color: { argb: INK } } },
    );

    let hr = 7;
    paintHeader(ws, hr, ['Puesto', 'DNI', 'Nombre completo', 'Carrera', 'Nota', 'Observación']);
    hr += 1;

    rows.forEach((row, i) => {
      paintDataRow(
        ws,
        hr,
        [
          i + 1,
          row.barcode,
          row.nombreEstudiante,
          row.carreraNombre || '—',
          Number(row.nota),
          row.observacion || '',
        ],
        { medalRank: i < 3 ? i + 1 : undefined },
      );
      const nc = ws.getCell(hr, 5);
      nc.numFmt = '0.0';
      nc.font = { bold: true, size: 10, name: 'Calibri' };
      nc.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getCell(hr, 3).alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getCell(hr, 4).alignment = { vertical: 'middle', horizontal: 'left' };
      hr += 1;
    });

    if (!rows.length) {
      setCell(ws, hr, 1, 'Sin notas en esta área.', {
        font: { italic: true, size: 10, color: { argb: MUTED } },
      });
    }

    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 14;
    ws.getColumn(3).width = 36;
    ws.getColumn(4).width = 32;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 22;
  }

  // ——— Solo top ———
  const rank = wb.addWorksheet('Solo top', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  await addLogo(rank, wb);
  rank.getRow(1).height = 52;
  setCell(rank, 1, 3, 'Solo ranking top (podio por área)', {
    font: { bold: true, size: 16, color: { argb: PRIMARY }, name: 'Calibri' },
    alignment: { vertical: 'middle' },
  });
  setCell(rank, 2, 3, `${escuela} · ${semanaEtiqueta}`, {
    font: { size: 10, color: { argb: MUTED } },
  });

  let rr = 4;
  paintHeader(rank, rr, ['Área', 'Puesto', 'DNI', 'Nombre', 'Nota']);
  rr += 1;
  for (const area of sortedAreas) {
    for (const t of area.top) {
      paintDataRow(
        rank,
        rr,
        [shortArea(area.areaNombre), t.puesto, t.barcode, t.nombreEstudiante, Number(t.nota)],
        { medalRank: t.puesto <= 3 ? t.puesto : undefined },
      );
      rank.getCell(rr, 5).numFmt = '0.0';
      rank.getCell(rr, 1).alignment = { vertical: 'middle', horizontal: 'left' };
      rank.getCell(rr, 4).alignment = { vertical: 'middle', horizontal: 'left' };
      rr += 1;
    }
  }
  rank.getColumn(1).width = 26;
  rank.getColumn(2).width = 10;
  rank.getColumn(3).width = 14;
  rank.getColumn(4).width = 36;
  rank.getColumn(5).width = 10;

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

/** HTML imprimible (fallback / vista previa). */
export function buildNotasRankingPdfHtml(
  semanaEtiqueta: string,
  porArea: NotasRankingArea[],
  meta?: NotasReportMeta,
): string {
  const escuela = schoolName(meta);
  const generado = format(meta?.generadoEn ?? new Date(), "d 'de' MMMM yyyy, HH:mm", {
    locale: es,
  });
  const sections = [...porArea]
    .sort((a, b) => a.orden - b.orden)
    .map((a) => {
      const mayor = a.top[0];
      const rows = a.top
        .map((t, i) => {
          const medal = i === 0 ? 'medal-1' : i === 1 ? 'medal-2' : i === 2 ? 'medal-3' : '';
          return `<tr class="${medal}"><td class="c">${t.puesto}</td><td class="c mono">${t.barcode}</td><td>${t.nombreEstudiante}</td><td class="c nota">${t.nota}</td></tr>`;
        })
        .join('');
      return `
        <section class="area">
          <h2>${a.areaNombre}</h2>
          <p class="lead"><strong>Mayor:</strong> ${
            mayor ? `${mayor.nombreEstudiante} (${mayor.nota})` : '—'
          }</p>
          <table>
            <thead><tr><th>Puesto</th><th>DNI</th><th>Nombre</th><th>Nota</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="empty">Sin notas</td></tr>'}</tbody>
          </table>
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<title>Ranking — ${semanaEtiqueta}</title>
<style>
  :root{--p:#1e4a7a;--m:#64748b;--l:#e2e8f0;--bg:#f8fafc}
  body{font-family:Calibri,Segoe UI,sans-serif;color:#0f172a;margin:0;padding:28px}
  .band{display:flex;align-items:center;gap:16px;background:var(--p);color:#fff;padding:18px 22px;border-radius:10px}
  .band img{height:48px;width:auto;background:#fff;border-radius:8px;padding:4px}
  .band h1{margin:0;font-size:20px}.band p{margin:4px 0 0;opacity:.9;font-size:13px}
  .meta{display:flex;gap:24px;margin:18px 0;font-size:13px;color:var(--m)}
  .meta strong{color:#0f172a;display:block}
  h2{font-size:14px;color:var(--p);border-left:4px solid var(--p);padding-left:8px;margin:22px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{background:var(--p);color:#fff;padding:8px 10px;text-align:left}
  td{padding:7px 10px;border-bottom:1px solid var(--l)}
  tr:nth-child(even) td{background:var(--bg)}
  .c{text-align:center}.nota{font-weight:700}.mono{font-family:Consolas,monospace}
  .medal-1 td{background:#fef3c7}.medal-2 td{background:#e2e8f0}.medal-3 td{background:#ffedd5}
  .foot{margin-top:24px;font-size:11px;color:var(--m);border-top:1px solid var(--l);padding-top:10px}
</style></head><body>
  <div class="band">
    <img src="/logo_asiscole_sf.png" alt="" onerror="this.style.display='none'"/>
    <div><h1>Ranking de notas por área</h1><p>${escuela}</p></div>
  </div>
  <div class="meta">
    <div><strong>Semana</strong>${semanaEtiqueta}</div>
    <div><strong>Código</strong>${meta?.semanaCodigo || '—'}</div>
    <div><strong>Generado</strong>${generado}</div>
  </div>
  ${sections}
  <div class="foot">${escuela} · Escala 0–20</div>
</body></html>`;
}

export async function buildNotasRankingPdfBlob(
  semanaEtiqueta: string,
  porArea: NotasRankingArea[],
  listado: NotasRow[],
  meta?: NotasReportMeta,
): Promise<Blob> {
  const escuela = schoolName(meta);
  const doc = new PdfReportDocument(
    'portrait',
    'RANKING DE NOTAS POR ÁREA',
    `${escuela} · ${semanaEtiqueta}`,
  );

  await doc.drawCoverHeader();
  doc.drawKeyValueList([
    { label: 'Institución', value: escuela },
    { label: 'Semana', value: semanaEtiqueta },
    { label: 'Código', value: meta?.semanaCodigo || '—' },
    {
      label: 'Generado',
      value: format(meta?.generadoEn ?? new Date(), "d MMM yyyy HH:mm", { locale: es }),
    },
  ]);

  const sorted = [...porArea].sort((a, b) => a.orden - b.orden);
  const avgGlobal = avgNota(listado);

  doc.drawKpiCards([
    { label: 'Áreas', value: sorted.length, tone: 'primary' },
    { label: 'Notas', value: listado.length, tone: 'info' },
    {
      label: 'Promedio',
      value: avgGlobal != null ? avgGlobal.toFixed(2) : '—',
      tone: 'success',
    },
  ]);

  for (const area of sorted) {
    const rows = rowsForArea(listado, area.areaId);
    const avg = avgNota(rows);
    const mayor = rows[0];

    doc.drawSectionTitle(area.areaNombre);
    doc.drawParagraph(
      `Alumnos: ${rows.length}  ·  Promedio: ${
        avg != null ? avg.toFixed(2) : '—'
      }  ·  Mayor: ${mayor ? `${mayor.nombreEstudiante} (${Number(mayor.nota).toFixed(1)})` : '—'}`,
      8.5,
    );

    const tableRows = rows.map((row, i) => ({
      puesto: String(i + 1),
      dni: row.barcode,
      nombre: row.nombreEstudiante,
      carrera: row.carreraNombre || '—',
      nota: Number(row.nota).toFixed(1),
    }));

    if (!tableRows.length) {
      doc.drawParagraph('Sin notas registradas en esta área.');
      continue;
    }

    doc.drawTable(
      [
        { header: 'Puesto', dataKey: 'puesto', width: 18, align: 'center' },
        { header: 'DNI', dataKey: 'dni', width: 28, align: 'center' },
        { header: 'Nombre', dataKey: 'nombre', width: 62 },
        { header: 'Carrera', dataKey: 'carrera', width: 48 },
        { header: 'Nota', dataKey: 'nota', width: 18, align: 'center' },
      ],
      tableRows,
    );
  }

  return doc.toBlob(0.04);
}
