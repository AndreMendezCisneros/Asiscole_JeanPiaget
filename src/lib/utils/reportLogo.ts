import {
  BRAND_WATERMARK,
  BRAND_REPORT_LOGO,
} from '@/config/brandAssets';

/** Logo Guardy para reportes Excel (marca de agua) y PDF — solo PNG SIE */

const WATERMARK_SOURCES = [BRAND_WATERMARK, BRAND_REPORT_LOGO] as const;

let headerLogoCache: ArrayBuffer | null = null;
let watermarkCache: ArrayBuffer | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    img.src = src;
  });
}

async function resolveWatermarkSrc(): Promise<string | null> {
  for (const path of WATERMARK_SOURCES) {
    try {
      const res = await fetch(path);
      if (res.ok) return path;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

async function imageToPngBuffer(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
  opacity: number
): Promise<ArrayBuffer | null> {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = Math.min(1, Math.max(0.04, opacity));
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 1)
  );
  return blob ? blob.arrayBuffer() : null;
}

/** Logo pequeño para esquina superior (PNG transparente) */
export async function getRoundedReportLogoBuffer(options?: {
  maxWidth?: number;
  maxHeight?: number;
}): Promise<{ buffer: ArrayBuffer; extension: 'png' } | null> {
  if (headerLogoCache) {
    return { buffer: headerLogoCache, extension: 'png' };
  }

  const src = await resolveWatermarkSrc();
  if (!src) return null;

  try {
    const img = await loadImage(src);
    const buffer = await imageToPngBuffer(
      img,
      options?.maxWidth ?? 160,
      options?.maxHeight ?? 56,
      1
    );
    if (!buffer) return null;
    headerLogoCache = buffer;
    return { buffer, extension: 'png' };
  } catch (e) {
    console.warn('reportLogo header:', e);
    return null;
  }
}

/** Marca de agua central semitransparente para Excel */
export async function getWatermarkLogoBuffer(
  opacity = 0.1
): Promise<{ buffer: ArrayBuffer; extension: 'png' } | null> {
  if (watermarkCache) {
    return { buffer: watermarkCache, extension: 'png' };
  }

  const src = await resolveWatermarkSrc();
  if (!src) return null;

  try {
    const img = await loadImage(src);
    const buffer = await imageToPngBuffer(img, 420, 380, opacity);
    if (!buffer) return null;
    watermarkCache = buffer;
    return { buffer, extension: 'png' };
  } catch (e) {
    console.warn('reportLogo watermark:', e);
    return null;
  }
}

export async function loadReportLogoForPdf(): Promise<HTMLImageElement | null> {
  const src = await resolveWatermarkSrc();
  if (!src) return null;
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

export const REPORT_LOGO_PATH = BRAND_WATERMARK;
export const WATERMARK_LOGO_PATH = BRAND_WATERMARK;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Logo en esquina superior del PDF */
export async function drawPdfReportLogo(
  pdf: import('jspdf').jsPDF,
  x: number,
  y: number,
  maxWidthMm = 34
): Promise<number> {
  const img = await loadReportLogoForPdf();
  const rounded = await getRoundedReportLogoBuffer({
    maxWidth: 280,
    maxHeight: 100,
  });

  if (!rounded) return y + 6;

  const base64 = arrayBufferToBase64(rounded.buffer);
  const dataUrl = `data:image/png;base64,${base64}`;
  const w = maxWidthMm;
  const h = img && img.width > 0 ? (img.height * w) / img.width : w * 0.38;
  pdf.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST');
  return y + h + 4;
}

/** Marca de agua centrada en cada página PDF */
export async function drawPdfWatermark(pdf: import('jspdf').jsPDF, opacity = 0.08): Promise<void> {
  const img = await loadReportLogoForPdf();
  const wm = await getWatermarkLogoBuffer(opacity);
  if (!img || !wm) return;

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const base64 = arrayBufferToBase64(wm.buffer);
  const dataUrl = `data:image/png;base64,${base64}`;

  const wmW = pageW * 0.55;
  const wmH = img.width > 0 ? (img.height * wmW) / img.width : wmW * 0.85;
  const x = (pageW - wmW) / 2;
  const y = (pageH - wmH) / 2;

  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    pdf.addImage(dataUrl, 'PNG', x, y, wmW, wmH, undefined, 'FAST');
  }
}
