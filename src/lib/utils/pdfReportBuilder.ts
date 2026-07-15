// @ts-nocheck
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { drawPdfReportLogo, drawPdfWatermark } from '@/lib/utils/reportLogo';

/** Paleta corporativa SIE (RGB) */
export const PDF_THEME = {
  primary: [30, 74, 122] as [number, number, number],
  primaryLight: [219, 228, 240] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  success: [22, 122, 78] as [number, number, number],
  successBg: [220, 252, 231] as [number, number, number],
  warning: [180, 95, 6] as [number, number, number],
  warningBg: [254, 243, 199] as [number, number, number],
  error: [185, 28, 28] as [number, number, number],
  errorBg: [254, 226, 226] as [number, number, number],
  info: [37, 99, 168] as [number, number, number],
  infoBg: [219, 234, 254] as [number, number, number],
};

export type PdfOrientation = 'portrait' | 'landscape';

export interface KpiCard {
  label: string;
  value: string | number;
  tone?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export interface PdfTableColumn {
  header: string;
  dataKey: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

/**
 * Documento PDF con cabecera, pie, secciones y tablas uniformes.
 */
export class PdfReportDocument {
  readonly pdf: jsPDF;
  readonly margin: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly contentWidth: number;
  readonly reportTitle: string;
  readonly reportSubtitle: string;
  y: number;
  private pageNumber = 1;

  constructor(
    orientation: PdfOrientation,
    reportTitle: string,
    reportSubtitle: string,
    margin = 14
  ) {
    this.pdf = new jsPDF(orientation, 'mm', 'a4');
    this.margin = margin;
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - margin * 2;
    this.reportTitle = reportTitle;
    this.reportSubtitle = reportSubtitle;
    this.y = margin;
  }

  async drawCoverHeader(): Promise<void> {
    const bandH = 36;
    const [r, g, b] = PDF_THEME.primary;
    this.pdf.setFillColor(r, g, b);
    this.pdf.rect(0, 0, this.pageWidth, bandH, 'F');

    await drawPdfReportLogo(this.pdf, this.margin, 6, 28);

    this.pdf.setTextColor(...PDF_THEME.white);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(16);
    this.pdf.text(this.reportTitle, this.pageWidth - this.margin, 14, { align: 'right' });

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(9);
    const subLines = this.pdf.splitTextToSize(this.reportSubtitle, this.contentWidth * 0.55);
    this.pdf.text(subLines, this.pageWidth - this.margin, 22, { align: 'right' });

    this.pdf.setFontSize(8);
    this.pdf.text('SIE — Sistema de Incidencias Escolares', this.pageWidth - this.margin, 30, {
      align: 'right',
    });
    this.pdf.text('Powered by Guardy', this.pageWidth - this.margin, 34, { align: 'right' });

    this.y = bandH + 10;
    this.pdf.setTextColor(...PDF_THEME.text);
  }

  drawSectionTitle(title: string): void {
    this.ensureSpace(14);
    const [r, g, b] = PDF_THEME.primary;
    this.pdf.setFillColor(r, g, b);
    this.pdf.rect(this.margin, this.y, 3, 8, 'F');

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(11);
    this.pdf.setTextColor(...PDF_THEME.text);
    this.pdf.text(title, this.margin + 6, this.y + 6);

    this.pdf.setDrawColor(...PDF_THEME.border);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(this.margin, this.y + 10, this.pageWidth - this.margin, this.y + 10);

    this.y += 14;
  }

  drawParagraph(text: string, fontSize = 9): void {
    this.ensureSpace(12);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(fontSize);
    this.pdf.setTextColor(...PDF_THEME.textMuted);
    const lines = this.pdf.splitTextToSize(text, this.contentWidth);
    this.pdf.text(lines, this.margin, this.y);
    this.y += lines.length * (fontSize * 0.42) + 4;
    this.pdf.setTextColor(...PDF_THEME.text);
  }

  drawKpiCards(cards: KpiCard[]): void {
    if (cards.length === 0) return;
    const cardH = 22;
    this.ensureSpace(cardH + 4);

    const gap = 4;
    const cardW = (this.contentWidth - gap * (cards.length - 1)) / cards.length;

    cards.forEach((card, i) => {
      const x = this.margin + i * (cardW + gap);
      const tone = card.tone ?? 'neutral';
      const colors = {
        primary: { bg: PDF_THEME.primaryLight, fg: PDF_THEME.primary },
        success: { bg: PDF_THEME.successBg, fg: PDF_THEME.success },
        warning: { bg: PDF_THEME.warningBg, fg: PDF_THEME.warning },
        error: { bg: PDF_THEME.errorBg, fg: PDF_THEME.error },
        info: { bg: PDF_THEME.infoBg, fg: PDF_THEME.info },
        neutral: { bg: [248, 250, 252] as [number, number, number], fg: PDF_THEME.text },
      }[tone];

      this.pdf.setFillColor(...colors.bg);
      this.pdf.setDrawColor(...PDF_THEME.border);
      this.pdf.setLineWidth(0.15);
      this.pdf.roundedRect(x, this.y, cardW, cardH, 2, 2, 'FD');

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(7.5);
      this.pdf.setTextColor(...PDF_THEME.textMuted);
      const labelLines = this.pdf.splitTextToSize(card.label.toUpperCase(), cardW - 4);
      this.pdf.text(labelLines, x + cardW / 2, this.y + 7, { align: 'center' });

      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setFontSize(14);
      this.pdf.setTextColor(...colors.fg);
      this.pdf.text(String(card.value), x + cardW / 2, this.y + 17, { align: 'center' });
    });

    this.y += cardH + 8;
    this.pdf.setTextColor(...PDF_THEME.text);
  }

  drawKeyValueList(
    items: { label: string; value: string }[],
    options?: { maxValueWidth?: number }
  ): void {
    this.ensureSpace(items.length * 7 + 4);
    const labelX = this.margin;
    const valueX = this.pageWidth - this.margin;

    items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, this.y - 1, this.contentWidth, 6.5, 'F');
      }
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(9);
      this.pdf.setTextColor(...PDF_THEME.text);
      this.pdf.text(item.label, labelX + 2, this.y + 4);

      this.pdf.setFont('helvetica', 'bold');
      const val = this.pdf.splitTextToSize(item.value, options?.maxValueWidth ?? 80);
      this.pdf.text(val, valueX - 2, this.y + 4, { align: 'right' });
      this.y += 7;
    });
    this.y += 4;
  }

  drawTable(
    columns: PdfTableColumn[],
    rows: Record<string, string | number>[],
    options?: { fontSize?: number; maxRows?: number }
  ): void {
    if (rows.length === 0) {
      this.drawParagraph('Sin registros para mostrar.');
      return;
    }

    const limited = options?.maxRows ? rows.slice(0, options.maxRows) : rows;
    const head = [columns.map((c) => c.header)];
    const body = limited.map((row) =>
      columns.map((c) => String(row[c.dataKey] ?? '—'))
    );

    const columnStyles: Record<number, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }> =
      {};
    columns.forEach((col, i) => {
      columnStyles[i] = {
        ...(col.width ? { cellWidth: col.width } : {}),
        halign: col.align ?? 'left',
      };
    });

    autoTable(this.pdf, {
      startY: this.y,
      margin: { left: this.margin, right: this.margin },
      head,
      body,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: options?.fontSize ?? 8,
        cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
        textColor: PDF_THEME.text,
        lineColor: PDF_THEME.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: PDF_THEME.primary,
        textColor: PDF_THEME.white,
        fontStyle: 'bold',
        fontSize: (options?.fontSize ?? 8) + 0.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles,
      didDrawPage: () => {
        this.pageNumber = this.pdf.getNumberOfPages();
      },
    });

    const finalY = (this.pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY;
    this.y = (finalY ?? this.y) + 8;
  }

  ensureSpace(neededMm: number): void {
    const footerReserve = 16;
    if (this.y + neededMm > this.pageHeight - footerReserve) {
      this.addPage();
    }
  }

  addPage(): void {
    this.pdf.addPage();
    this.pageNumber = this.pdf.getNumberOfPages();
    this.drawPageStrip();
    this.y = 28;
  }

  private drawPageStrip(): void {
    const [r, g, b] = PDF_THEME.primary;
    this.pdf.setFillColor(r, g, b);
    this.pdf.rect(0, 0, this.pageWidth, 14, 'F');
    this.pdf.setTextColor(...PDF_THEME.white);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9);
    this.pdf.text(this.reportTitle, this.margin, 9);
    this.y = 20;
    this.pdf.setTextColor(...PDF_THEME.text);
  }

  async finalize(filename: string, watermarkOpacity = 0.07): Promise<void> {
    const totalPages = this.pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      this.pdf.setPage(p);
      this.drawFooter(p, totalPages);
    }
    await drawPdfWatermark(this.pdf, watermarkOpacity);
    this.pdf.save(filename);
  }

  private drawFooter(page: number, total: number): void {
    const y = this.pageHeight - 10;
    this.pdf.setDrawColor(...PDF_THEME.border);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(this.margin, y - 4, this.pageWidth - this.margin, y - 4);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7.5);
    this.pdf.setTextColor(...PDF_THEME.textMuted);
    this.pdf.text('SIE — Sistema de Incidencias Escolares · Guardy', this.margin, y);
    this.pdf.text(`Página ${page} de ${total}`, this.pageWidth - this.margin, y, { align: 'right' });
    this.pdf.text(
      format(new Date(), "dd/MM/yyyy HH:mm", { locale: es }),
      this.pageWidth / 2,
      y,
      { align: 'center' }
    );
  }
}

export function buildFilterSubtitle(parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' · ');
}
