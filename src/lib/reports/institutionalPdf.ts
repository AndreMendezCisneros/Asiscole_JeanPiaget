// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- los tipos de jspdf no resuelven en este proyecto (igual que pdfReportBuilder.ts)
// @ts-nocheck
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfReportLogo } from '@/lib/utils/reportLogo';
import type { ChartImage } from './chartImages';

type RGB = [number, number, number];

/** Paleta sobria: tinta, gris y un solo acento institucional. */
const C = {
  ink: [17, 24, 39] as RGB,
  text: [51, 65, 85] as RGB,
  muted: [100, 116, 139] as RGB,
  faint: [148, 163, 184] as RGB,
  rule: [203, 213, 225] as RGB,
  hair: [226, 232, 240] as RGB,
  accent: [30, 58, 95] as RGB,
  warn: [180, 83, 9] as RGB,
};

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

/**
 * Documento con estilo de informe institucional: portada con ficha técnica e índice,
 * secciones numeradas, figuras y tablas con número y fuente, encabezado y pie discretos.
 */
export class InstitutionalPdf {
  readonly pdf: jsPDF;
  readonly W: number;
  readonly H: number;
  readonly M = 20;
  readonly CW: number;
  y = 0;
  private figure = 0;
  private table = 0;
  private toc: { level: 1 | 2; title: string; page: number }[] = [];
  private tocSlot: { page: number; y: number } | null = null;

  constructor(
    readonly school: string,
    readonly title: string,
    readonly source: string,
  ) {
    this.pdf = new jsPDF('portrait', 'mm', 'a4');
    this.W = this.pdf.internal.pageSize.getWidth();
    this.H = this.pdf.internal.pageSize.getHeight();
    this.CW = this.W - this.M * 2;
  }

  private color(c: RGB) {
    this.pdf.setTextColor(c[0], c[1], c[2]);
  }

  private font(size: number, style: 'normal' | 'bold' | 'italic' = 'normal') {
    this.pdf.setFont('helvetica', style);
    this.pdf.setFontSize(size);
  }

  private line(x1: number, y1: number, x2: number, y2: number, c: RGB, w = 0.2) {
    this.pdf.setDrawColor(c[0], c[1], c[2]);
    this.pdf.setLineWidth(w);
    this.pdf.line(x1, y1, x2, y2);
  }

  /** Texto con espaciado entre letras (versalitas simuladas). */
  private tracked(text: string, x: number, y: number, size: number, c: RGB, align: 'left' | 'right' = 'left') {
    this.font(size, 'bold');
    this.color(c);
    this.pdf.setCharSpace(0.6);
    this.pdf.text(text.toUpperCase(), x, y, { align });
    this.pdf.setCharSpace(0);
  }

  get page(): number {
    return this.pdf.getNumberOfPages();
  }

  /* ───────────── Portada ───────────── */

  async cover(opts: {
    subtitle: string;
    facts: [string, string][];
    /** Reserva espacio para el índice, que se escribe al final. */
    withToc?: boolean;
  }): Promise<void> {
    const { M } = this;
    await drawPdfReportLogo(this.pdf, M, 18, 16);
    this.tracked(this.school, M + 22, 25, 8.5, C.accent);
    this.font(8.5);
    this.color(C.muted);
    this.pdf.text('Sistema de Incidencias y Asistencia Escolar', M + 22, 30);

    this.line(M, 44, this.W - M, 44, C.accent, 0.6);

    this.font(26, 'bold');
    this.color(C.ink);
    const titleLines = this.pdf.splitTextToSize(this.title, this.CW);
    this.pdf.text(titleLines, M, 62);
    let y = 62 + titleLines.length * 10;
    this.font(12);
    this.color(C.text);
    this.pdf.text(opts.subtitle, M, y);
    y += 14;

    // Ficha técnica
    this.tracked('Ficha técnica', M, y, 7.5, C.muted);
    y += 3;
    this.line(M, y, this.W - M, y, C.rule);
    y += 6;
    for (const [k, v] of opts.facts) {
      this.font(8.5);
      this.color(C.muted);
      this.pdf.text(k, M, y);
      this.font(9.5);
      this.color(C.ink);
      const lines = this.pdf.splitTextToSize(v, this.CW - 45);
      this.pdf.text(lines, M + 45, y);
      y += Math.max(1, lines.length) * 4.6 + 2.2;
    }
    this.line(M, y - 1, this.W - M, y - 1, C.hair);
    this.y = y + 10;

    if (opts.withToc) {
      this.tocSlot = { page: 1, y: this.y };
    }
  }

  /** Índice en la portada (se llama al final, cuando ya se conocen las páginas). */
  private writeToc() {
    if (!this.tocSlot) return;
    this.pdf.setPage(this.tocSlot.page);
    let y = this.tocSlot.y;
    this.tracked('Contenido', this.M, y, 7.5, C.muted);
    y += 3;
    this.line(this.M, y, this.W - this.M, y, C.rule);
    y += 6;
    for (const e of this.toc) {
      if (y > this.H - 30) break;
      const indent = e.level === 1 ? 0 : 6;
      this.font(e.level === 1 ? 9.5 : 8.5, e.level === 1 ? 'bold' : 'normal');
      this.color(e.level === 1 ? C.ink : C.text);
      this.pdf.text(e.title, this.M + indent, y);
      const tw = this.pdf.getTextWidth(e.title);
      this.font(8.5);
      this.color(C.muted);
      this.pdf.text(String(e.page), this.W - this.M, y, { align: 'right' });
      // línea de puntos
      this.pdf.setLineDashPattern([0.3, 1.2], 0);
      this.line(this.M + indent + tw + 2, y - 0.6, this.W - this.M - 7, y - 0.6, C.faint, 0.25);
      this.pdf.setLineDashPattern([], 0);
      y += e.level === 1 ? 6 : 5;
    }
  }

  /* ───────────── Páginas ───────────── */

  newPage(): void {
    this.pdf.addPage();
    this.y = 28;
  }

  ensure(mm: number): void {
    if (this.y + mm > this.H - 22) this.newPage();
  }

  /* ───────────── Bloques ───────────── */

  /** Franja de cifras clave: número grande, etiqueta y nota, separados por líneas finas. */
  keyFigures(items: { label: string; value: string | number; note?: string; tone?: 'accent' | 'warn' }[], perRow = 4): void {
    const gap = 6;
    const w = (this.CW - gap * (perRow - 1)) / perRow;
    for (let start = 0; start < items.length; start += perRow) {
      this.ensure(26);
      items.slice(start, start + perRow).forEach((it, i) => {
        const x = this.M + i * (w + gap);
        const c = it.tone === 'warn' ? C.warn : C.accent;
        this.line(x, this.y, x + w, this.y, c, 0.7);
        this.font(7);
        this.color(C.muted);
        this.pdf.setCharSpace(0.3);
        this.pdf.text(this.pdf.splitTextToSize(it.label.toUpperCase(), w)[0], x, this.y + 5);
        this.pdf.setCharSpace(0);
        this.font(String(it.value).length > 8 ? 14 : 20, 'bold');
        this.color(C.ink);
        this.pdf.text(String(it.value), x, this.y + 14);
        if (it.note) {
          this.font(7.5);
          this.color(C.muted);
          this.pdf.text(this.pdf.splitTextToSize(it.note, w)[0], x, this.y + 19.5);
        }
      });
      this.y += 27;
    }
  }

  /** Título de sección numerada: «1  Incidencias». */
  section(num: string, title: string, tone: 'accent' | 'warn' = 'accent'): void {
    this.ensure(30);
    const c = tone === 'warn' ? C.warn : C.accent;
    this.font(20, 'bold');
    this.color(c);
    this.pdf.text(num, this.M, this.y + 7);
    this.font(16, 'bold');
    this.color(C.ink);
    this.pdf.text(title, this.M + (num ? 10 : 0), this.y + 7);
    this.line(this.M, this.y + 11, this.W - this.M, this.y + 11, C.rule, 0.3);
    this.toc.push({ level: 1, title: num ? `${num}  ${title}` : title, page: this.page });
    this.y += 18;
  }

  /** Subapartado «1.1 Evolución mensual»; reserva espacio para lo que sigue. */
  subsection(num: string, title: string, keepWithMm = 70): void {
    this.ensure(12 + keepWithMm);
    this.font(11, 'bold');
    this.color(C.ink);
    const label = num ? `${num}  ${title}` : title;
    this.pdf.text(label, this.M, this.y + 4);
    this.toc.push({ level: 2, title: label, page: this.page });
    this.y += 9;
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; italic?: boolean; indent?: number } = {}): void {
    const size = opts.size ?? 9.5;
    const indent = opts.indent ?? 0;
    this.font(size, opts.italic ? 'italic' : 'normal');
    const lines = this.pdf.splitTextToSize(text, this.CW - indent);
    const lh = size * 0.47;
    this.ensure(lines.length * lh + 2);
    this.color(opts.color ?? C.text);
    this.pdf.text(lines, this.M + indent, this.y + size * 0.35, { lineHeightFactor: 1.4 });
    this.y += lines.length * lh * 1.0 + 3;
  }

  /** Párrafos numerados del resumen ejecutivo. */
  numbered(items: string[]): void {
    items.forEach((t, i) => {
      this.font(9.5);
      const lines = this.pdf.splitTextToSize(t, this.CW - 9);
      const h = lines.length * 4.6 + 2.5;
      this.ensure(h);
      this.font(9.5, 'bold');
      this.color(C.accent);
      this.pdf.text(`${i + 1}.`, this.M, this.y + 3.4);
      this.font(9.5);
      this.color(C.text);
      this.pdf.text(lines, this.M + 7, this.y + 3.4, { lineHeightFactor: 1.4 });
      this.y += h;
    });
    this.y += 3;
  }

  /** Puntos de atención: trazo lateral, sin caja. */
  attention(title: string, items: string[]): void {
    if (items.length === 0) return;
    this.font(9.5);
    const blocks = items.map((t) => this.pdf.splitTextToSize(t, this.CW - 8));
    const h = 7 + blocks.reduce((s, l) => s + l.length * 4.5 + 2, 0);
    this.ensure(h + 4);
    this.line(this.M, this.y, this.M, this.y + h, C.warn, 0.8);
    this.font(8, 'bold');
    this.color(C.warn);
    this.pdf.setCharSpace(0.4);
    this.pdf.text(title.toUpperCase(), this.M + 5, this.y + 3.5);
    this.pdf.setCharSpace(0);
    let y = this.y + 9;
    this.font(9.5);
    this.color(C.text);
    for (const lines of blocks) {
      this.pdf.text(lines, this.M + 5, y, { lineHeightFactor: 1.4 });
      y += lines.length * 4.5 + 2;
    }
    this.y += h + 6;
  }

  /** Figura numerada con pie y fuente. */
  chart(image: ChartImage, caption: string, widthMm = this.CW): void {
    const h = (image.height / image.width) * widthMm;
    this.ensure(h + 12);
    const x = this.M + (this.CW - widthMm) / 2;
    this.pdf.addImage(image.dataUrl, 'PNG', x, this.y, widthMm, h, undefined, 'FAST');
    this.y += h + 3;
    this.caption(`Figura ${++this.figure}.`, caption);
  }

  /** Dos figuras lado a lado con un solo pie. */
  chartPair(images: [ChartImage, ChartImage], caption: string): void {
    const gap = 8;
    const w = (this.CW - gap) / 2;
    const hs = images.map((im) => (im.height / im.width) * w);
    const h = Math.max(...hs);
    this.ensure(h + 12);
    images.forEach((im, i) => this.pdf.addImage(im.dataUrl, 'PNG', this.M + i * (w + gap), this.y, w, hs[i], undefined, 'FAST'));
    this.y += h + 3;
    this.caption(`Figura ${++this.figure}.`, caption);
  }

  private caption(label: string, text: string) {
    this.font(8, 'bold');
    this.color(C.ink);
    this.pdf.text(label, this.M, this.y + 2.5);
    const lw = this.pdf.getTextWidth(label) + 1.5;
    this.font(8, 'italic');
    this.color(C.muted);
    const lines = this.pdf.splitTextToSize(`${text} Fuente: ${this.source}.`, this.CW - lw);
    this.pdf.text(lines, this.M + lw, this.y + 2.5);
    this.y += lines.length * 3.6 + 4;
  }

  /** «Lectura: …» bajo una figura. */
  reading(text: string): void {
    this.font(9.5);
    const lines = this.pdf.splitTextToSize(text, this.CW - 18);
    const h = lines.length * 4.5 + 2;
    this.ensure(h);
    this.font(8.5, 'bold');
    this.color(C.accent);
    this.pdf.text('Lectura', this.M, this.y + 3.3);
    this.font(9.5);
    this.color(C.text);
    this.pdf.text(lines, this.M + 18, this.y + 3.3, { lineHeightFactor: 1.4 });
    this.y += h + 4;
  }

  /** Tabla de estilo académico: título arriba, cabecera con línea, filas con líneas finas. */
  dataTable(
    title: string,
    columns: TableColumn[],
    rows: Record<string, string | number>[],
    opts: { fontSize?: number; note?: string } = {},
  ): void {
    if (rows.length === 0) return;
    this.ensure(22);
    this.font(8, 'bold');
    this.color(C.ink);
    const label = `Tabla ${++this.table}.`;
    this.pdf.text(label, this.M, this.y + 2.5);
    this.font(8);
    this.color(C.text);
    this.pdf.text(title, this.M + this.pdf.getTextWidth(label) + 1.5, this.y + 2.5);
    this.y += 4.5;

    const fs = opts.fontSize ?? 8;
    const columnStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> = {};
    columns.forEach((c, i) => (columnStyles[i] = { ...(c.width ? { cellWidth: c.width } : {}), halign: c.align ?? 'left' }));

    autoTable(this.pdf, {
      startY: this.y,
      margin: { left: this.M, right: this.M, top: 28, bottom: 22 },
      head: [columns.map((c) => c.header)],
      body: rows.map((r) => columns.map((c) => String(r[c.key] ?? '—'))),
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: fs,
        textColor: C.text,
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 },
        lineWidth: 0,
      },
      headStyles: { fontStyle: 'bold', textColor: C.ink, fontSize: fs - 0.5 },
      columnStyles,
      didParseCell: (d) => {
        if (d.section === 'head') d.cell.styles.halign = columns[d.column.index]?.align ?? 'left';
      },
      didDrawCell: (d) => {
        const { x, y, width, height } = d.cell;
        if (d.section === 'head') {
          this.line(x, y, x + width, y, C.ink, 0.45);
          this.line(x, y + height, x + width, y + height, C.ink, 0.25);
        } else {
          this.line(x, y + height, x + width, y + height, C.hair, 0.15);
        }
      },
    });
    const last = (this.pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? this.y;
    this.line(this.M, last, this.W - this.M, last, C.ink, 0.45);
    this.y = last + 2;
    this.font(7.5, 'italic');
    this.color(C.muted);
    this.pdf.text(`${opts.note ? `${opts.note} ` : ''}Fuente: ${this.source}.`, this.M, this.y + 2.5);
    this.y += 9;
  }

  /** Firmas al cierre. */
  signatures(labels: string[]): void {
    this.ensure(40);
    this.y += 22;
    const gap = 16;
    const w = (this.CW - gap * (labels.length - 1)) / labels.length;
    labels.forEach((l, i) => {
      const x = this.M + i * (w + gap);
      this.line(x, this.y, x + w, this.y, C.ink, 0.3);
      this.font(8.5);
      this.color(C.muted);
      this.pdf.text(l, x + w / 2, this.y + 5, { align: 'center' });
    });
    this.y += 12;
  }

  /* ───────────── Cierre ───────────── */

  private headersAndFooters(issued: string) {
    const total = this.page;
    for (let p = 1; p <= total; p++) {
      this.pdf.setPage(p);
      if (p > 1) {
        this.font(7.5);
        this.color(C.muted);
        this.pdf.text(this.school, this.M, 14);
        this.pdf.text(this.title, this.W - this.M, 14, { align: 'right' });
        this.line(this.M, 17, this.W - this.M, 17, C.rule, 0.2);
      }
      this.line(this.M, this.H - 14, this.W - this.M, this.H - 14, C.rule, 0.2);
      this.font(7.5);
      this.color(C.muted);
      this.pdf.text(`Emitido el ${issued} · SIE Asiscole`, this.M, this.H - 9.5);
      this.pdf.text(`${p} / ${total}`, this.W - this.M, this.H - 9.5, { align: 'right' });
    }
  }

  save(filename: string, issued: string): void {
    this.writeToc();
    this.headersAndFooters(issued);
    this.pdf.save(filename);
  }
}
