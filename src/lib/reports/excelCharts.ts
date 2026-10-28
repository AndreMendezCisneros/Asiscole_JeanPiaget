import JSZip from 'jszip';

/**
 * Gráficos nativos de Excel (DrawingML) añadidos al .xlsx que genera ExcelJS, que no los soporta.
 * Cada serie apunta a un rango de celdas: si se cambian los valores en Excel, el gráfico se actualiza.
 * Se incluye la caché de valores para que el archivo se vea bien también en visores que no recalculan.
 */

export type ChartKind = 'col' | 'bar' | 'line' | 'doughnut' | 'stackedCol';

export interface ChartSeries {
  name: string;
  /** Rango de valores: 'Hoja'!$B$8:$B$15 */
  ref: string;
  values: number[];
  /** Hex sin #, p. ej. '2F63B8'. */
  color: string;
  /** Color por punto (anillo). */
  pointColors?: string[];
}

export interface ChartSpec {
  sheet: string;
  /** Columna y fila (base 0) de la esquina superior izquierda. */
  col: number;
  row: number;
  widthPx: number;
  heightPx: number;
  kind: ChartKind;
  title: string;
  categories: { ref: string; values: string[] };
  series: ChartSeries[];
  showValues?: boolean;
}

const EMU = 9525;
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const REL_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colName(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** 'Hoja'!$B$8:$B$15 a partir de columna (base 1) y filas (base 1). */
export function rangeRef(sheet: string, col: number, fromRow: number, toRow: number): string {
  const c = colName(col);
  return `'${sheet.replace(/'/g, "''")}'!$${c}$${fromRow}:$${c}$${toRow}`;
}

const fill = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const text = (size: number, color: string, bold = false) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}">${fill(color)}<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-PE"/></a:p></c:txPr>`;

function strCache(values: string[]): string {
  return `<c:strCache><c:ptCount val="${values.length}"/>${values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`)
    .join('')}</c:strCache>`;
}

function numCache(values: number[]): string {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values
    .map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`)
    .join('')}</c:numCache>`;
}

function dLbls(show: boolean, percent = false): string {
  if (!show) return '';
  return `<c:dLbls>${text(800, '334155', true)}<c:showLegendKey val="0"/><c:showVal val="${percent ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${percent ? 1 : 0}"/><c:showBubbleSize val="0"/>${percent ? '<c:showLeaderLines val="0"/>' : ''}</c:dLbls>`;
}

function seriesXml(spec: ChartSpec, s: ChartSeries, i: number): string {
  const head = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
  const cat = `<c:cat><c:strRef><c:f>${esc(spec.categories.ref)}</c:f>${strCache(spec.categories.values)}</c:strRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${esc(s.ref)}</c:f>${numCache(s.values)}</c:numRef></c:val>`;
  if (spec.kind === 'line') {
    return `<c:ser>${head}<c:spPr><a:ln w="28575" cap="rnd">${fill(s.color)}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill('FFFFFF')}<a:ln w="19050">${fill(s.color)}</a:ln></c:spPr></c:marker>${dLbls(Boolean(spec.showValues))}${cat}${val}<c:smooth val="0"/></c:ser>`;
  }
  if (spec.kind === 'doughnut') {
    const pts = (s.pointColors ?? [])
      .map((c, p) => `<c:dPt><c:idx val="${p}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}<a:ln w="19050">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`)
      .join('');
    return `<c:ser>${head}${pts}${dLbls(true, true)}${cat}${val}</c:ser>`;
  }
  return `<c:ser>${head}<c:spPr>${fill(s.color)}<a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/>${dLbls(Boolean(spec.showValues) && spec.kind !== 'stackedCol')}${cat}${val}</c:ser>`;
}

function axes(kind: ChartKind): string {
  const horizontal = kind === 'bar';
  const cat = `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${fill('CBD5E1')}</a:ln></c:spPr>${text(850, '475569')}<c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const val = `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${horizontal ? 1 : 0}"/><c:axPos val="${horizontal ? 't' : 'l'}"/><c:majorGridlines><c:spPr><a:ln w="6350">${fill('E2E8F0')}<a:prstDash val="dash"/></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${text(800, '64748B')}<c:crossAx val="111"/><c:crosses val="${horizontal ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  return cat + val;
}

export function chartXml(spec: ChartSpec): string {
  const series = spec.series.map((s, i) => seriesXml(spec, s, i)).join('');
  let plot: string;
  if (spec.kind === 'doughnut') {
    plot = `<c:doughnutChart><c:varyColors val="1"/>${series}<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
  } else if (spec.kind === 'line') {
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="111"/><c:axId val="222"/></c:lineChart>${axes('line')}`;
  } else {
    const stacked = spec.kind === 'stackedCol';
    plot = `<c:barChart><c:barDir val="${spec.kind === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${series}<c:gapWidth val="${stacked ? 55 : 70}"/>${stacked ? '<c:overlap val="100"/>' : ''}<c:axId val="111"/><c:axId val="222"/></c:barChart>${axes(spec.kind)}`;
  }
  const legend =
    spec.series.length > 1 || spec.kind === 'doughnut'
      ? `<c:legend><c:legendPos val="${spec.kind === 'doughnut' ? 'r' : 'b'}"/><c:overlay val="0"/>${text(850, '334155')}</c:legend>`
      : '';
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="es-PE" sz="1100" b="1">${fill('111827')}<a:latin typeface="Calibri"/></a:rPr><a:t>${esc(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${title}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${fill('FFFFFF')}<a:ln w="9525">${fill('E2E8F0')}</a:ln></c:spPr>${text(900, '334155')}</c:chartSpace>`;
}

function anchorXml(spec: ChartSpec, id: number, rid: string): string {
  return `<xdr:oneCellAnchor><xdr:from><xdr:col>${spec.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${spec.widthPx * EMU}" cy="${spec.heightPx * EMU}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="Gráfico ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`;
}

function attr(xml: string, tag: string, name: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${name}="([^"]*)"`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1]);
}

/** Inserta los gráficos en el libro ya generado y devuelve el nuevo archivo. */
export async function injectCharts(buffer: ArrayBuffer, specs: ChartSpec[]): Promise<Blob> {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file('xl/workbook.xml')!.async('string');
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  let contentTypes = await zip.file('[Content_Types].xml')!.async('string');

  // nombre de hoja → archivo
  const sheetFile = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)) {
    const name = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const rel = new RegExp(`<Relationship\\b[^>]*Id="${m[2]}"[^>]*Target="([^"]*)"`).exec(wbRels);
    if (rel) sheetFile.set(name, `xl/${rel[1].replace(/^\/?xl\//, '')}`);
  }

  let chartNo = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f)).length;
  let drawingNo = Object.keys(zip.files).filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f)).length;
  let shapeId = 1000;

  const bySheet = new Map<string, ChartSpec[]>();
  for (const s of specs) bySheet.set(s.sheet, [...(bySheet.get(s.sheet) ?? []), s]);

  for (const [sheet, list] of bySheet) {
    const file = sheetFile.get(sheet);
    if (!file) continue;
    const relsPath = file.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels');
    let sheetRels = zip.file(relsPath) ? await zip.file(relsPath)!.async('string') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

    // dibujo de la hoja (ExcelJS crea uno para el logo); si no hay, se crea
    const drawingRel = new RegExp(`<Relationship\\b[^>]*Type="${REL_DRAWING}"[^>]*Target="([^"]*)"`).exec(sheetRels)
      ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]*)"[^>]*Type="${REL_DRAWING}"`).exec(sheetRels);
    let drawingPath: string;
    let drawingXml: string;
    if (drawingRel) {
      drawingPath = `xl/${drawingRel[1].replace(/^\.\.\//, '')}`;
      drawingXml = await zip.file(drawingPath)!.async('string');
    } else {
      drawingNo += 1;
      drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
      drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"></xdr:wsDr>`;
      const rid = `rIdDrw${drawingNo}`;
      sheetRels = sheetRels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNo}.xml"/></Relationships>`);
      let sheetXml = await zip.file(file)!.async('string');
      const tag = `<drawing r:id="${rid}"/>`;
      sheetXml = /<legacyDrawing\b|<tableParts\b|<extLst\b/.test(sheetXml)
        ? sheetXml.replace(/(<legacyDrawing\b|<tableParts\b|<extLst\b)/, `${tag}$1`)
        : sheetXml.replace('</worksheet>', `${tag}</worksheet>`);
      if (!/xmlns:r=/.test(sheetXml)) sheetXml = sheetXml.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
      zip.file(file, sheetXml);
      zip.file(relsPath, sheetRels);
      contentTypes = contentTypes.replace('</Types>', `<Override PartName="/${drawingPath}" ContentType="${CT_DRAWING}"/></Types>`);
    }
    // Los prefijos a: y r: deben estar en la raíz (ExcelJS declara r: solo dentro de la imagen del logo)
    const root = /<xdr:wsDr[\s>][^>]*>?/.exec(drawingXml)?.[0] ?? '';
    if (!root.includes('xmlns:a=')) drawingXml = drawingXml.replace('<xdr:wsDr ', `<xdr:wsDr xmlns:a="${NS_A}" `);
    if (!root.includes('xmlns:r=')) drawingXml = drawingXml.replace('<xdr:wsDr ', `<xdr:wsDr xmlns:r="${NS_R}" `);

    const drawingRelsPath = drawingPath.replace(/drawings\/(drawing\d+\.xml)$/, 'drawings/_rels/$1.rels');
    let drawingRels = zip.file(drawingRelsPath)
      ? await zip.file(drawingRelsPath)!.async('string')
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    const usedIds = new Set(attr(drawingRels, 'Relationship', 'Id'));

    let anchors = '';
    for (const spec of list) {
      chartNo += 1;
      let rid = `rIdChart${chartNo}`;
      while (usedIds.has(rid)) rid += 'x';
      usedIds.add(rid);
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(spec));
      contentTypes = contentTypes.replace('</Types>', `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="${CT_CHART}"/></Types>`);
      drawingRels = drawingRels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${REL_CHART}" Target="../charts/chart${chartNo}.xml"/></Relationships>`);
      anchors += anchorXml(spec, ++shapeId, rid);
    }
    drawingXml = drawingXml.replace('</xdr:wsDr>', `${anchors}</xdr:wsDr>`);
    zip.file(drawingPath, drawingXml);
    zip.file(drawingRelsPath, drawingRels);
  }

  zip.file('[Content_Types].xml', contentTypes);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}
