import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SCHOOL_NAME } from '@/config/siteSeo';
import type { Incident, IncidentEvidence } from '@/types';
import {
  getReincidenceLevelDescription,
  getReincidenceLevelSummaryLabel,
  getSuggestedAction,
} from '@/lib/utils/reincidenceUtils';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';

type ImageFormat = 'JPEG' | 'PNG';

interface LoadedPdfImage {
  dataUrl: string;
  format: ImageFormat;
  width: number;
  height: number;
}

async function loadImageForPdf(url: string): Promise<LoadedPdfImage | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const format: ImageFormat =
      blob.type.includes('png') || url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';

    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });

    return { dataUrl, format, ...dims };
  } catch {
    return null;
  }
}

function fitImageBox(
  imgW: number,
  imgH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return { w: imgW * scale, h: imgH * scale };
}

async function drawEvidenceSection(
  doc: PdfReportDocument,
  evidences: IncidentEvidence[],
): Promise<void> {
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

  const loadedImages = await Promise.all(
    evidences.map((ev) => loadImageForPdf(ev.url)),
  );

  for (let i = 0; i < evidences.length; i++) {
    const ev = evidences[i];
    const loaded = loadedImages[i];

    doc.ensureSpace(maxCellH + 14);
    if (col === 0) {
      rowBaseY = doc.y;
    }

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
    const frameH = maxCellH;

    doc.pdf.setDrawColor(226, 232, 240);
    doc.pdf.setLineWidth(0.2);
    doc.pdf.roundedRect(x, frameY, cellW, frameH, 1.5, 1.5, 'S');

    if (loaded) {
      const { w, h } = fitImageBox(loaded.width, loaded.height, cellW - 4, frameH - 4);
      const imgX = x + (cellW - w) / 2;
      const imgY = frameY + (frameH - h) / 2;
      doc.pdf.addImage(loaded.dataUrl, loaded.format, imgX, imgY, w, h, undefined, 'FAST');
    } else {
      doc.pdf.setFontSize(8);
      doc.pdf.setTextColor(185, 28, 28);
      doc.pdf.text('No se pudo cargar la imagen', x + 4, frameY + frameH / 2);
    }

    col++;
    if (col >= cols || i === evidences.length - 1) {
      doc.y = frameY + frameH + 10;
      col = 0;
    }
  }
}

function drawSignatureBlock(doc: PdfReportDocument): void {
  doc.ensureSpace(48);
  doc.drawParagraph(
    'Documento oficial para comunicación con el apoderado. Las firmas confirman la recepción del reporte.',
    8,
  );

  const blockY = doc.y + 4;
  const colW = (doc.contentWidth - 8) / 2;
  const lineY = blockY + 22;

  const blocks = [
    { title: 'Firma del apoderado', x: doc.margin },
    { title: 'Firma del tutor / docente', x: doc.margin + colW + 8 },
  ];

  blocks.forEach((block) => {
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

/**
 * Genera PDF profesional de una incidencia (formato institucional + fotos de evidencia).
 */
export async function exportIncidentReportPdf(
  incident: Incident,
  evidences: IncidentEvidence[],
): Promise<void> {
  const registeredAt = format(
    new Date(incident.registeredAt),
    "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
    { locale: es },
  );

  const subtitle = buildFilterSubtitle([
    SCHOOL_NAME,
    `Incidencia Nº ${incident.id}`,
    `Generado ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
  ]);

  const doc = new PdfReportDocument('portrait', 'REPORTE DE INCIDENCIA DISCIPLINARIA', subtitle);
  await doc.drawCoverHeader();

  doc.drawKpiCards([
    { label: 'Nº registro', value: incident.id, tone: 'primary' },
    { label: 'Estado', value: incident.status, tone: incident.status === 'Activa' ? 'warning' : 'neutral' },
    {
      label: 'Reincidencia',
      value: getReincidenceLevelSummaryLabel(incident.reincidenceLevel),
      tone: incident.reincidenceLevel >= 3 ? 'error' : 'info',
    },
    { label: 'Fotos', value: evidences.length, tone: evidences.length > 0 ? 'success' : 'neutral' },
  ]);

  doc.drawSectionTitle('Datos del estudiante');
  doc.drawKeyValueList([
    { label: 'Nombre completo', value: incident.student?.fullName ?? '—' },
    {
      label: 'Grado y sección',
      value: `${incident.student?.level ?? '—'} · ${incident.student?.grade ?? '—'} "${incident.student?.section ?? '—'}"`,
    },
    { label: 'Código de barras', value: incident.student?.barcode ?? '—' },
  ]);

  doc.drawSectionTitle('Detalle de la falta');
  doc.drawKeyValueList([
    { label: 'Tipo de falta', value: incident.faultType?.name ?? '—' },
    { label: 'Categoría', value: incident.faultType?.category ?? '—' },
    { label: 'Gravedad', value: incident.faultType?.severity ?? '—' },
    { label: 'Puntos', value: String(incident.faultType?.points ?? '—') },
    {
      label: 'Descripción',
      value: incident.faultType?.description?.trim() || 'Sin descripción adicional',
    },
  ]);

  doc.drawSectionTitle('Nivel de reincidencia');
  doc.drawKeyValueList([
    {
      label: 'Nivel actual',
      value: `${incident.reincidenceLevel} — ${getReincidenceLevelDescription(incident.reincidenceLevel)}`,
    },
    { label: 'Acción sugerida', value: getSuggestedAction(incident.reincidenceLevel) },
  ]);

  doc.drawSectionTitle('Observaciones del registro');
  doc.drawParagraph(incident.observations?.trim() || 'Sin observaciones registradas.');

  doc.drawSectionTitle('Información de registro');
  doc.drawKeyValueList([
    { label: 'Registrado por', value: incident.registeredByUser?.fullName ?? '—' },
    { label: 'Fecha y hora', value: registeredAt },
    { label: 'Estado del reporte', value: incident.status },
  ]);

  doc.drawSectionTitle('Evidencia fotográfica');
  await drawEvidenceSection(doc, evidences);

  doc.drawSectionTitle('Conformidad y firmas');
  drawSignatureBlock(doc);

  const fileName = `Incidencia_${incident.id}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  await doc.finalize(fileName);
}
