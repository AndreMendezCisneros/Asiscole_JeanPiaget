import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import type { CompromisoAlarmaTipo } from '@/types/compromisoAlarma';

const LOGO_SRC = '/logo-jean-piaget.jpg';

/** Paleta institucional Jean Piaget (comunicados oficiales) */
const JP = {
  navy: [15, 40, 80] as [number, number, number],
  navySoft: [30, 58, 110] as [number, number, number],
  beige: [214, 201, 170] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  muted: [90, 90, 90] as [number, number, number],
  line: [200, 200, 200] as [number, number, number],
  boxBg: [248, 249, 252] as [number, number, number],
  boxBorder: [210, 218, 230] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const TIPO_LABEL: Record<CompromisoAlarmaTipo, string> = {
  tardanza: 'tardanzas reiteradas',
  falta: 'inasistencias / faltas reiteradas',
  pago: 'pendientes de pensión',
};

const TIPO_PROMESA: Record<CompromisoAlarmaTipo, string> = {
  tardanza:
    'garantizar la puntualidad de mi hijo(a) en el ingreso al colegio, evitando nuevas tardanzas',
  falta:
    'garantizar la asistencia regular de mi hijo(a) a clases, evitando nuevas inasistencias injustificadas',
  pago:
    'ponerme al día con las pensiones pendientes y mantener los pagos al corriente según el cronograma del colegio',
};

export type CompromisoPdfInput = {
  schoolName: string;
  studentName: string;
  grade: string;
  section: string;
  level: string;
  /** Código de carnet / barras (opcional; se muestra ordenado, no como DNI) */
  barcode?: string | null;
  parentName: string;
  tipo: CompromisoAlarmaTipo;
  signedAt?: Date;
  countsHint?: string | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

async function imageToJpegDataUrl(img: HTMLImageElement, maxPx = 360): Promise<string | null> {
  const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Genera e imprime/descarga el PDF de compromiso del apoderado
 * con cabecera institucional Jean Piaget (estilo comunicado).
 */
export async function downloadCompromisoAlarmaPdf(input: CompromisoPdfInput): Promise<void> {
  const when = input.signedAt ?? new Date();
  const fechaTxt = format(when, "d 'de' MMMM 'de' yyyy", { locale: es });
  const tipoTxt = TIPO_LABEL[input.tipo];
  const school = (input.schoolName || 'Colegio Privado Jean Piaget').trim();
  const parent = (input.parentName || '').trim();
  const grade = (input.grade || '—').trim();
  const section = (input.section || '—').trim();
  const level = (input.level || '—').trim();
  const code = (input.barcode || '').trim();

  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 12;

  // ── Cabecera institucional (como comunicado oficial) ──────────────────────
  let logoDrawn = false;
  try {
    const img = await loadImage(LOGO_SRC);
    const dataUrl = await imageToJpegDataUrl(img, 420);
    if (dataUrl) {
      const logoMm = 22;
      const logoH = img.width > 0 ? (img.height * logoMm) / img.width : logoMm;
      pdf.addImage(dataUrl, 'JPEG', margin, y, logoMm, logoH, undefined, 'FAST');
      logoDrawn = true;

      pdf.setTextColor(...JP.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text('COLEGIO PRIVADO', margin + logoMm + 4, y + 8);
      pdf.setTextColor(...JP.navy);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(16);
      pdf.text('Jean Piaget', margin + logoMm + 4, y + 16);
    }
  } catch {
    /* sin logo: texto solo */
  }

  if (!logoDrawn) {
    pdf.setTextColor(...JP.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('COLEGIO PRIVADO', margin, y + 8);
    pdf.setTextColor(...JP.navy);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.text('Jean Piaget', margin, y + 16);
  }

  // Barra Facebook (derecha)
  const fbW = 52;
  const fbH = 10;
  const fbX = pageW - margin - fbW;
  const fbY = y + 4;
  pdf.setFillColor(...JP.navy);
  pdf.roundedRect(fbX, fbY, fbW, fbH, 1.2, 1.2, 'F');
  pdf.setFillColor(...JP.white);
  pdf.circle(fbX + 6, fbY + fbH / 2, 3.2, 'F');
  pdf.setTextColor(...JP.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('f', fbX + 6, fbY + fbH / 2 + 1.1, { align: 'center' });
  pdf.setTextColor(...JP.white);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Jean Piaget Ayacucho', fbX + 11, fbY + fbH / 2 + 1.1);

  y = 38;
  // Franja beige
  pdf.setFillColor(...JP.beige);
  pdf.rect(0, y, pageW, 2.2, 'F');
  y += 14;

  // Título
  pdf.setTextColor(...JP.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('ACTA DE COMPROMISO FAMILIAR', pageW / 2, y, { align: 'center' });
  y += 8;

  // Fecha (derecha, estilo comunicado)
  pdf.setFont('times', 'italic');
  pdf.setFontSize(11);
  pdf.setTextColor(...JP.muted);
  pdf.text(`Ayacucho, ${fechaTxt}.`, pageW - margin, y, { align: 'right' });
  y += 10;

  // Saludo
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...JP.text);
  pdf.text('Estimado(a) padre / madre / apoderado(a):', margin, y);
  y += 8;

  // Ficha del estudiante (ordenada)
  const boxH = code ? 34 : 28;
  pdf.setFillColor(...JP.boxBg);
  pdf.setDrawColor(...JP.boxBorder);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'FD');

  const col1 = margin + 4;
  const col2 = margin + contentW * 0.52;
  const row1 = y + 7;
  const row2 = y + 16;
  const row3 = y + 25;

  const label = (t: string, x: number, yy: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...JP.muted);
    pdf.text(t, x, yy);
  };
  const value = (t: string, x: number, yy: number, maxW = 80) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...JP.text);
    const lines = pdf.splitTextToSize(t || '—', maxW);
    pdf.text(lines[0] ?? '—', x, yy);
  };

  label('ESTUDIANTE', col1, row1);
  value(input.studentName.toUpperCase(), col1 + 28, row1, contentW - 36);

  label('GRADO', col1, row2);
  value(grade, col1 + 18, row2, 40);
  label('SECCIÓN', col1 + 55, row2);
  value(section, col1 + 78, row2, 28);
  label('NIVEL', col2, row2);
  value(level, col2 + 16, row2, 50);

  if (code) {
    label('CÓDIGO DE CARNET', col1, row3);
    value(code, col1 + 40, row3, 60);
  }

  y += boxH + 8;

  // Cuerpo
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...JP.text);
  const lineH = 5.4;

  const intro = [
    `Yo, ${parent || '________________________________'}, apoderado(a) del(la) estudiante`,
    `señalado(a) en la ficha precedente, me presento ante las autoridades del ${school}`,
    `por motivo de ${tipoTxt}` +
      (input.countsHint ? ` (${input.countsHint})` : '') +
      `.`,
  ].join(' ');

  let lines = pdf.splitTextToSize(intro, contentW);
  pdf.text(lines, margin, y);
  y += lines.length * lineH + 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...JP.navy);
  pdf.text('DECLARACIÓN Y COMPROMISO', margin, y);
  y += 7;

  pdf.setDrawColor(...JP.beige);
  pdf.setLineWidth(0.6);
  pdf.line(margin, y - 3, margin + 55, y - 3);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10.5);
  pdf.setTextColor(...JP.text);

  const body = [
    `Declaro haber sido informado(a) de la situación de mi hijo(a) y asumo el compromiso de ${TIPO_PROMESA[input.tipo]}.`,
    'Me comprometo a no reiterar esta conducta y a colaborar con el colegio en el seguimiento respectivo.',
    'Entiendo que, tras la firma de este documento, el colegio reinicia el aviso sonoro correspondiente, y que si se vuelve a alcanzar el umbral establecido (tardanzas, faltas o deuda de pensión), se me citará nuevamente.',
  ];

  for (const paragraph of body) {
    lines = pdf.splitTextToSize(paragraph, contentW);
    pdf.text(lines, margin, y);
    y += lines.length * lineH + 4;
  }

  y += 14;
  const colW = contentW / 2;
  const ySign = y;

  pdf.setDrawColor(...JP.line);
  pdf.setLineWidth(0.5);
  pdf.line(margin, ySign + 20, margin + colW - 12, ySign + 20);
  pdf.line(margin + colW + 12, ySign + 20, margin + contentW, ySign + 20);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...JP.muted);
  pdf.text('Firma del apoderado(a)', margin, ySign + 26);
  pdf.text('Firma / sello del colegio', margin + colW + 12, ySign + 26);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...JP.text);
  pdf.text(parent || '________________________', margin, ySign + 31);
  pdf.text(school, margin + colW + 12, ySign + 31);

  y = ySign + 42;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...JP.muted);
  lines = pdf.splitTextToSize(
    'Documento institucional del Colegio Privado Jean Piaget — Ayacucho. Conservar una copia firmada en el expediente del estudiante.',
    contentW,
  );
  pdf.text(lines, margin, y);

  const safeName = input.studentName.replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/gi, '_').slice(0, 40);
  pdf.save(`compromiso_${input.tipo}_${safeName}.pdf`);
}
