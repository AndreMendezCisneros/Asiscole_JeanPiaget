import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SCHOOL_NAME } from '@/config/siteSeo';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';
import { PdfReportDocument, buildFilterSubtitle } from '@/lib/utils/pdfReportBuilder';
import { fitImageBox, loadImageForPdf } from '@/lib/utils/exportIncidentReportPdf';

function longDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return format(new Date(y, m - 1, d), "EEEE dd 'de' MMMM 'de' yyyy", { locale: es });
}

function minutesBetween(later: string, earlier: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMin(later) - toMin(earlier));
}

/** Tardanza o inasistencia según el estado justificado del registro. */
export function justificationKindLabel(record: Pick<PersonalArrivalRecord, 'status'>): string {
  return record.status === 'Tarde justificada' ? 'Tardanza justificada' : 'Inasistencia justificada';
}

async function drawEvidence(doc: PdfReportDocument, record: PersonalArrivalRecord, evidenceUrl: string | null) {
  const ev = record.evidence;
  if (!ev || !evidenceUrl) {
    doc.drawParagraph('No se adjuntó evidencia a esta justificación.');
    return;
  }
  if (ev.mime === 'application/pdf') {
    doc.drawParagraph(`Evidencia adjunta en PDF: ${ev.fileName}. Se descarga aparte desde el sistema (RR.HH. > Justificar asistencia del personal).`);
    return;
  }
  const loaded = await loadImageForPdf(evidenceUrl);
  const frameH = 110;
  doc.ensureSpace(frameH + 14);
  const x = doc.margin;
  const w = doc.contentWidth;
  doc.pdf.setFont('helvetica', 'normal');
  doc.pdf.setFontSize(7.5);
  doc.pdf.setTextColor(100, 116, 139);
  doc.pdf.text(ev.fileName, x, doc.y);
  const frameY = doc.y + 3;
  doc.pdf.setDrawColor(226, 232, 240);
  doc.pdf.setLineWidth(0.2);
  doc.pdf.roundedRect(x, frameY, w, frameH, 1.5, 1.5, 'S');
  if (loaded) {
    const fit = fitImageBox(loaded.width, loaded.height, w - 4, frameH - 4);
    doc.pdf.addImage(loaded.dataUrl, loaded.format, x + (w - fit.w) / 2, frameY + (frameH - fit.h) / 2, fit.w, fit.h, undefined, 'FAST');
  } else {
    doc.pdf.setFontSize(8);
    doc.pdf.setTextColor(185, 28, 28);
    doc.pdf.text('No se pudo cargar la imagen', x + 4, frameY + frameH / 2);
  }
  doc.y = frameY + frameH + 10;
}

function drawSignatures(doc: PdfReportDocument) {
  doc.ensureSpace(44);
  const blockY = doc.y + 4;
  const colW = (doc.contentWidth - 8) / 2;
  const lineY = blockY + 22;
  [
    { title: 'Firma del trabajador', x: doc.margin },
    { title: 'Firma de RR.HH.', x: doc.margin + colW + 8 },
  ].forEach((b) => {
    doc.pdf.setFont('helvetica', 'bold');
    doc.pdf.setFontSize(9);
    doc.pdf.setTextColor(15, 23, 42);
    doc.pdf.text(b.title, b.x, blockY);
    doc.pdf.setDrawColor(30, 74, 122);
    doc.pdf.setLineWidth(0.35);
    doc.pdf.line(b.x, lineY, b.x + colW, lineY);
    doc.pdf.setFont('helvetica', 'normal');
    doc.pdf.setFontSize(7.5);
    doc.pdf.setTextColor(100, 116, 139);
    doc.pdf.text('Nombre y DNI', b.x, lineY + 5);
  });
  doc.y = lineY + 14;
}

/** PDF institucional de una justificación del personal (con la foto de evidencia si la hay). */
export async function exportPersonalJustificationPdf(
  record: PersonalArrivalRecord,
  personal: Personal,
  evidenceUrl: string | null,
): Promise<void> {
  const isLate = record.status === 'Tarde justificada';
  const subtitle = buildFilterSubtitle([
    SCHOOL_NAME,
    `Justificación Nº ${record.id}`,
    `Generado ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
  ]);
  const doc = new PdfReportDocument('portrait', 'JUSTIFICACIÓN DE ASISTENCIA DEL PERSONAL', subtitle);
  await doc.drawCoverHeader();

  doc.drawKpiCards([
    { label: 'Nº registro', value: record.id, tone: 'primary' },
    { label: 'Tipo', value: isLate ? 'Tardanza' : 'Inasistencia', tone: isLate ? 'warning' : 'error' },
    { label: 'Estado', value: 'Justificada', tone: 'success' },
    { label: 'Evidencia', value: record.evidence ? 'Sí' : 'No', tone: record.evidence ? 'success' : 'neutral' },
  ]);

  doc.drawSectionTitle('Datos del trabajador');
  doc.drawKeyValueList([
    { label: 'Nombre completo', value: personal.fullName },
    { label: 'DNI', value: personal.barcode || '—' },
    { label: 'Cargo', value: personal.position?.trim() || '—' },
    { label: 'Categoría', value: personal.category },
  ]);

  doc.drawSectionTitle('Detalle');
  const detail = [
    { label: 'Fecha', value: longDate(record.date) },
    { label: 'Tipo', value: justificationKindLabel(record) },
    { label: 'Hora de entrada', value: record.expectedEntry ?? '—' },
  ];
  if (isLate && record.arrivalTime) {
    detail.push({ label: 'Hora de llegada', value: record.arrivalTime });
    if (record.expectedEntry) {
      detail.push({ label: 'Minutos de tardanza', value: String(minutesBetween(record.arrivalTime, record.expectedEntry)) });
    }
  } else {
    detail.push({ label: 'Hora de salida', value: record.expectedExit ?? '—' });
  }
  doc.drawKeyValueList(detail);

  doc.drawSectionTitle('Motivo de la justificación');
  doc.drawParagraph(record.justificationReason?.trim() || 'Sin motivo registrado.');

  doc.drawSectionTitle('Información de registro');
  doc.drawKeyValueList([
    { label: 'Justificado por', value: record.justifiedByName ?? '—' },
    {
      label: 'Fecha y hora',
      value: record.justifiedAt
        ? format(new Date(record.justifiedAt), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
        : '—',
    },
  ]);

  doc.drawSectionTitle('Evidencia');
  await drawEvidence(doc, record, evidenceUrl);

  doc.drawSectionTitle('Conformidad y firmas');
  drawSignatures(doc);

  const safeName = personal.fullName.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
  await doc.finalize(`Justificacion_${safeName}_${record.date}.pdf`);
}
