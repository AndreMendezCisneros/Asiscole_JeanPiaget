import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SCHOOL_NAME } from '@/config/siteSeo';
import type { IncidentEvidence } from '@/types';
import type { PersonalIncident } from '@/lib/services/personalIncidentsService';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { fitImageBox, loadImageForPdf } from '@/lib/utils/exportIncidentReportPdf';

async function drawEvidenceSection(doc: PdfReportDocument, evidences: IncidentEvidence[]): Promise<void> {
  if (evidences.length === 0) {
    doc.drawParagraph('No se adjuntaron fotografías a esta incidencia.');
    return;
  }

  const cols = evidences.length === 1 ? 1 : 2;
  const gap = 5;
  const cellW = (doc.contentWidth - gap * (cols - 1)) / cols;
  const maxCellH = 72;
  let col = 0;
  let rowBaseY = doc.y;
  const loadedImages = await Promise.all(evidences.map((ev) => loadImageForPdf(ev.url)));

  for (let i = 0; i < evidences.length; i++) {
    const ev = evidences[i];
    const loaded = loadedImages[i];
    doc.ensureSpace(maxCellH + 14);
    if (col === 0) rowBaseY = doc.y;
    const x = doc.margin + col * (cellW + gap);

    doc.pdf.setFont('helvetica', 'bold');
    doc.pdf.setFontSize(8);
    doc.pdf.setTextColor(30, 74, 122);
    doc.pdf.text(`Evidencia ${i + 1}`, x, rowBaseY);
    doc.pdf.setFont('helvetica', 'normal');
    doc.pdf.setFontSize(7);
    doc.pdf.setTextColor(100, 116, 139);
    const nameLines = doc.pdf.splitTextToSize(ev.filename, cellW);
    doc.pdf.text(nameLines, x, rowBaseY + 4);

    const frameY = rowBaseY + 4 + nameLines.length * 3 + 2;
    doc.pdf.setDrawColor(226, 232, 240);
    doc.pdf.setLineWidth(0.2);
    doc.pdf.roundedRect(x, frameY, cellW, maxCellH, 1.5, 1.5, 'S');

    if (loaded) {
      const { w, h } = fitImageBox(loaded.width, loaded.height, cellW - 4, maxCellH - 4);
      doc.pdf.addImage(
        loaded.dataUrl,
        loaded.format,
        x + (cellW - w) / 2,
        frameY + (maxCellH - h) / 2,
        w,
        h,
        undefined,
        'FAST',
      );
    } else {
      doc.pdf.setFontSize(8);
      doc.pdf.setTextColor(185, 28, 28);
      doc.pdf.text('No se pudo cargar la imagen', x + 4, frameY + maxCellH / 2);
    }

    col++;
    if (col >= cols || i === evidences.length - 1) {
      doc.y = frameY + maxCellH + 10;
      col = 0;
    }
  }
}

function drawSignatureBlock(doc: PdfReportDocument): void {
  doc.ensureSpace(48);
  doc.drawParagraph('Documento interno de incidencia del personal. Las firmas confirman la recepción del reporte.', 8);
  const blockY = doc.y + 4;
  const colW = (doc.contentWidth - 8) / 2;
  const lineY = blockY + 22;
  [
    { title: 'Firma del trabajador', x: doc.margin },
    { title: 'Firma de RR.HH. / Dirección', x: doc.margin + colW + 8 },
  ].forEach((block) => {
    doc.pdf.setFont('helvetica', 'bold');
    doc.pdf.setFontSize(9);
    doc.pdf.setTextColor(15, 23, 42);
    doc.pdf.text(block.title, block.x, blockY);
    doc.pdf.setDrawColor(30, 74, 122);
    doc.pdf.setLineWidth(0.35);
    doc.pdf.line(block.x, lineY, block.x + colW, lineY);
    doc.pdf.setFont('helvetica', 'normal');
    doc.pdf.setFontSize(7.5);
    doc.pdf.setTextColor(100, 116, 139);
    doc.pdf.text('Nombre y DNI', block.x, lineY + 5);
  });
  doc.pdf.setFont('helvetica', 'normal');
  doc.pdf.setFontSize(9);
  doc.pdf.setTextColor(15, 23, 42);
  doc.pdf.text('Fecha: ____ / ____ / ________', doc.margin, lineY + 16);
  doc.y = lineY + 24;
}

export async function exportPersonalIncidentPdf(
  incident: PersonalIncident,
  evidences: IncidentEvidence[],
): Promise<void> {
  const registeredAt = format(new Date(incident.registeredAt), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", {
    locale: es,
  });
  const subtitle = buildFilterSubtitle([
    SCHOOL_NAME,
    `Incidencia Nº ${incident.id}`,
    `Generado ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
  ]);
  const doc = new PdfReportDocument('portrait', 'REPORTE DE INCIDENCIA DEL PERSONAL', subtitle);
  await doc.drawCoverHeader();

  doc.drawKpiCards([
    { label: 'Nº registro', value: incident.id, tone: 'primary' },
    { label: 'Estado', value: incident.status, tone: incident.status === 'Activa' ? 'warning' : 'neutral' },
    { label: 'Gravedad', value: incident.isSerious ? 'Grave' : 'Leve', tone: incident.isSerious ? 'error' : 'info' },
    { label: 'Fotos', value: evidences.length, tone: evidences.length > 0 ? 'success' : 'neutral' },
  ]);

  doc.drawSectionTitle('Datos del trabajador');
  doc.drawKeyValueList([
    { label: 'Nombre completo', value: incident.personalName },
    { label: 'DNI', value: incident.personalBarcode || '—' },
    { label: 'Categoría', value: incident.personalCategory ?? '—' },
  ]);

  doc.drawSectionTitle('Detalle de la falta');
  doc.drawKeyValueList([
    { label: 'Tipo de falta', value: incident.faultName },
    { label: 'Categoría', value: incident.faultCategory ?? '—' },
    { label: 'Gravedad', value: incident.isSerious ? 'Grave' : 'Leve' },
  ]);

  doc.drawSectionTitle('Observaciones del registro');
  doc.drawParagraph(incident.observations?.trim() || 'Sin observaciones registradas.');

  if (incident.resolutionReason) {
    doc.drawSectionTitle(incident.status === 'Justificada' ? 'Motivo de justificación' : 'Motivo de anulación');
    doc.drawParagraph(incident.resolutionReason);
  }

  doc.drawSectionTitle('Información de registro');
  doc.drawKeyValueList([
    { label: 'Registrado por', value: incident.registeredByName ?? '—' },
    { label: 'Fecha y hora', value: registeredAt },
    { label: 'Estado del reporte', value: incident.status },
  ]);

  doc.drawSectionTitle('Evidencia fotográfica');
  await drawEvidenceSection(doc, evidences);
  doc.drawSectionTitle('Conformidad y firmas');
  drawSignatureBlock(doc);

  await doc.finalize(`Incidencia_personal_${incident.id}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}
