/**
 * Gráficos del informe exportado dibujados en Canvas 2D (PNG).
 * La misma imagen se usa en el PDF y en el Excel, así ambos se ven igual.
 */

export interface ChartImage {
  dataUrl: string;
  /** Tamaño lógico en px (la imagen real va a SCALE×). */
  width: number;
  height: number;
}

const SCALE = 3;
const FONT = 'Helvetica, Arial, sans-serif';

export const CHART_COLORS = {
  ink: '#0f172a',
  muted: '#64748b',
  grid: '#e2e8f0',
  axis: '#cbd5e1',
  blue: '#2f63b8',
  blueSoft: '#b9cdf0',
  orange: 'hsl(13 72% 48%)',
  orangeSoft: 'hsl(20 89% 82%)',
  white: '#ffffff',
};

/** Escala secuencial azul (incidencias) y naranja (tardanzas): 0 = vacío. */
export const BLUE_RAMP = ['#f5f7fa', '#e6effc', '#c4d7f5', '#8eb1e8', '#2f63b8', '#1b3c7e'];
export const ORANGE_RAMP = ['#f5f7fa', '#fde6da', '#f9c4a7', '#f39a73', '#d4501f', '#a0321a'];
export const RAMP_TEXT = ['#64748b', '#0f172a', '#0f172a', '#0f172a', '#ffffff', '#ffffff'];

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'middle';
  return { canvas, ctx };
}

function done(canvas: HTMLCanvasElement, width: number, height: number): ChartImage {
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

function font(size: number, weight: 'normal' | 'bold' = 'normal') {
  return `${weight} ${size}px ${FONT}`;
}

function niceMax(max: number): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}

function roundedTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return;
  const rr = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function roundedRightRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0) return;
  const rr = Math.min(r, h / 2, w);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawYGrid(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
  ticks: number[],
  max: number,
) {
  ctx.font = font(10);
  ctx.textAlign = 'right';
  for (const t of ticks) {
    const y = bottom - (t / max) * (bottom - top);
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.fillText(String(t), left - 6, y);
  }
}

/* ───────────── Área con promedio y pico ───────────── */

export function areaTrendChart(
  points: { label: string; value: number }[],
  opts: { width?: number; height?: number; color?: string } = {},
): ChartImage {
  const width = opts.width ?? 760;
  const height = opts.height ?? 260;
  const color = opts.color ?? CHART_COLORS.blue;
  const { canvas, ctx } = createCanvas(width, height);
  const left = 44;
  const right = width - 16;
  const top = 26;
  const bottom = height - 30;
  const { max, ticks } = niceMax(Math.max(0, ...points.map((p) => p.value)));
  drawYGrid(ctx, left, right, top, bottom, ticks, max);

  const n = points.length;
  const xAt = (i: number) => (n <= 1 ? (left + right) / 2 : left + (i / (n - 1)) * (right - left));
  const yAt = (v: number) => bottom - (v / max) * (bottom - top);

  if (n > 0) {
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, 'rgba(47, 99, 184, 0.28)');
    grad.addColorStop(1, 'rgba(47, 99, 184, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(xAt(0), bottom);
    points.forEach((p, i) => ctx.lineTo(xAt(i), yAt(p.value)));
    ctx.lineTo(xAt(n - 1), bottom);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(p.value)) : ctx.lineTo(xAt(i), yAt(p.value))));
    ctx.stroke();

    const avg = points.reduce((s, p) => s + p.value, 0) / n;
    const ay = yAt(avg);
    ctx.strokeStyle = CHART_COLORS.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(left, ay);
    ctx.lineTo(right, ay);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = font(10);
    ctx.textAlign = 'right';
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.fillText(`Promedio ${avg.toFixed(1)}`, right, ay - 8);

    const peakIdx = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
    points.forEach((p, i) => {
      const isPeak = i === peakIdx && p.value > 0;
      ctx.beginPath();
      ctx.arc(xAt(i), yAt(p.value), isPeak ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isPeak ? color : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isPeak ? '#ffffff' : color;
      ctx.stroke();
      if (isPeak) {
        ctx.beginPath();
        ctx.arc(xAt(i), yAt(p.value), 7.5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.font = font(10, isPeak ? 'bold' : 'normal');
      ctx.textAlign = 'center';
      ctx.fillStyle = isPeak ? CHART_COLORS.ink : CHART_COLORS.muted;
      ctx.fillText(String(p.value), xAt(i), yAt(p.value) - (isPeak ? 15 : 11));
    });
  }

  ctx.font = font(11);
  ctx.textAlign = 'center';
  ctx.fillStyle = CHART_COLORS.muted;
  points.forEach((p, i) => ctx.fillText(p.label, xAt(i), bottom + 16));
  return done(canvas, width, height);
}

/* ───────────── Barras verticales ───────────── */

export function verticalBarChart(
  points: { label: string; value: number }[],
  opts: {
    width?: number;
    height?: number;
    color?: string;
    softColor?: string;
    /** Resalta la barra mayor y suaviza el resto. */
    highlightMax?: boolean;
    valueFormatter?: (v: number) => string;
  } = {},
): ChartImage {
  const width = opts.width ?? 760;
  const height = opts.height ?? 240;
  const color = opts.color ?? CHART_COLORS.blue;
  const soft = opts.softColor ?? CHART_COLORS.blueSoft;
  const fmt = opts.valueFormatter ?? ((v: number) => String(v));
  const { canvas, ctx } = createCanvas(width, height);
  const left = 40;
  const right = width - 12;
  const top = 22;
  const bottom = height - 30;
  const { max, ticks } = niceMax(Math.max(0, ...points.map((p) => p.value)));
  drawYGrid(ctx, left, right, top, bottom, ticks, max);

  const n = Math.max(1, points.length);
  const slot = (right - left) / n;
  const barW = Math.min(46, slot * 0.62);
  const maxVal = Math.max(...points.map((p) => p.value));
  const step = Math.ceil(n / Math.floor((right - left) / 46));

  points.forEach((p, i) => {
    const x = left + i * slot + (slot - barW) / 2;
    const h = (p.value / max) * (bottom - top);
    ctx.fillStyle = !opts.highlightMax || (p.value === maxVal && maxVal > 0) ? color : soft;
    roundedTopRect(ctx, x, bottom - h, barW, h, 4);
    if (p.value > 0 && n <= 16) {
      ctx.font = font(10, 'bold');
      ctx.textAlign = 'center';
      ctx.fillStyle = CHART_COLORS.ink;
      ctx.fillText(fmt(p.value), x + barW / 2, bottom - h - 8);
    }
    if (i % step === 0) {
      ctx.font = font(10);
      ctx.textAlign = 'center';
      ctx.fillStyle = CHART_COLORS.muted;
      ctx.fillText(truncate(ctx, p.label, slot * step - 4), x + barW / 2, bottom + 15);
    }
  });
  return done(canvas, width, height);
}

/* ───────────── Barras horizontales (ranking) ───────────── */

export function horizontalBarChart(
  points: { label: string; value: number; color?: string; note?: string }[],
  opts: {
    width?: number;
    color?: string;
    softColor?: string;
    /** Cuántas de arriba van en color fuerte (el resto suave). */
    strongTop?: number;
    labelWidth?: number;
    valueFormatter?: (v: number, i: number) => string;
  } = {},
): ChartImage {
  const width = opts.width ?? 760;
  const rowH = 26;
  const height = Math.max(60, points.length * rowH + 12);
  const color = opts.color ?? CHART_COLORS.blue;
  const soft = opts.softColor ?? CHART_COLORS.blueSoft;
  const labelW = opts.labelWidth ?? 170;
  const fmt = opts.valueFormatter ?? ((v: number) => String(v));
  const { canvas, ctx } = createCanvas(width, height);
  const left = labelW + 10;
  // Deja sitio a la derecha para el valor y, si hay, la nota («75% del aula»)
  const right = width - (points.some((p) => p.note) ? 150 : 70);
  const max = Math.max(1, ...points.map((p) => p.value));

  points.forEach((p, i) => {
    const y = 6 + i * rowH;
    ctx.font = font(11);
    ctx.textAlign = 'right';
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.fillText(truncate(ctx, p.label, labelW), labelW, y + rowH / 2);
    ctx.fillStyle = '#f1f5f9';
    roundedRightRect(ctx, left, y + 6, right - left, rowH - 12, 3);
    const w = (p.value / max) * (right - left);
    ctx.fillStyle = p.color ?? (opts.strongTop == null || i < opts.strongTop ? color : soft);
    roundedRightRect(ctx, left, y + 6, Math.max(w, p.value > 0 ? 2 : 0), rowH - 12, 3);
    ctx.font = font(11, 'bold');
    ctx.textAlign = 'left';
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.fillText(fmt(p.value, i), right + 8, y + rowH / 2);
    if (p.note) {
      ctx.font = font(9);
      ctx.fillStyle = CHART_COLORS.muted;
      ctx.fillText(p.note, right + 8 + ctx.measureText(fmt(p.value, i)).width + 14, y + rowH / 2);
    }
  });
  return done(canvas, width, height);
}

/* ───────────── Barras apiladas ───────────── */

export function stackedBarChart(
  categories: string[],
  series: { label: string; color: string; values: number[] }[],
  opts: { width?: number; height?: number } = {},
): ChartImage {
  const width = opts.width ?? 760;
  const height = opts.height ?? 280;
  const { canvas, ctx } = createCanvas(width, height);
  const left = 40;
  const right = width - 12;
  const top = 40;
  const bottom = height - 30;
  const totals = categories.map((_, i) => series.reduce((s, ser) => s + (ser.values[i] ?? 0), 0));
  const { max, ticks } = niceMax(Math.max(0, ...totals));
  drawYGrid(ctx, left, right, top, bottom, ticks, max);

  // Leyenda arriba, texto en tinta
  let lx = left;
  ctx.font = font(10);
  ctx.textAlign = 'left';
  for (const s of series) {
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(lx + 4, 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.fillText(s.label, lx + 12, 14);
    lx += ctx.measureText(s.label).width + 28;
  }

  const n = Math.max(1, categories.length);
  const slot = (right - left) / n;
  const barW = Math.min(44, slot * 0.62);
  categories.forEach((cat, i) => {
    const x = left + i * slot + (slot - barW) / 2;
    let acc = 0;
    series.forEach((s, si) => {
      const v = s.values[i] ?? 0;
      if (v <= 0) return;
      const y0 = bottom - (acc / max) * (bottom - top);
      const h = (v / max) * (bottom - top);
      ctx.fillStyle = s.color;
      const isTop = series.slice(si + 1).every((later) => (later.values[i] ?? 0) <= 0);
      if (isTop) roundedTopRect(ctx, x, y0 - h, barW, h, 4);
      else ctx.fillRect(x, y0 - h, barW, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y0 - h, barW, 1);
      acc += v;
    });
    if (totals[i] > 0) {
      ctx.font = font(10, 'bold');
      ctx.textAlign = 'center';
      ctx.fillStyle = CHART_COLORS.ink;
      ctx.fillText(String(totals[i]), x + barW / 2, bottom - (totals[i] / max) * (bottom - top) - 8);
    }
    ctx.font = font(10);
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.fillText(truncate(ctx, cat, slot - 2), x + barW / 2, bottom + 15);
  });
  return done(canvas, width, height);
}

/* ───────────── Torta (anillo) con leyenda ───────────── */

export function donutChart(
  slices: { label: string; value: number; color: string }[],
  opts: { width?: number; height?: number; centerLabel?: string } = {},
): ChartImage {
  const width = opts.width ?? 420;
  const height = opts.height ?? 190;
  const { canvas, ctx } = createCanvas(width, height);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = Math.min(height / 2 - 10, 82);
  const cx = r + 12;
  const cy = height / 2;
  const inner = r * 0.64;

  if (total === 0) {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
    ctx.fill();
  } else {
    let a = -Math.PI / 2;
    for (const s of slices) {
      if (s.value <= 0) continue;
      const da = (s.value / total) * Math.PI * 2;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a, a + da);
      ctx.arc(cx, cy, inner, a + da, a, true);
      ctx.closePath();
      ctx.fill();
      // separación del color del fondo entre porciones
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
      a += da;
    }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = font(22, 'bold');
  ctx.fillText(String(total), cx, cy - 4);
  ctx.font = font(9);
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.fillText((opts.centerLabel ?? 'total').toUpperCase(), cx, cy + 14);

  const lx = cx + r + 22;
  const lineH = 20;
  const ly0 = cy - ((slices.length - 1) * lineH) / 2;
  slices.forEach((s, i) => {
    const y = ly0 + i * lineH;
    ctx.globalAlpha = s.value === 0 ? 0.45 : 1;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(lx + 5, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = font(11);
    ctx.textAlign = 'left';
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.fillText(truncate(ctx, s.label, width - lx - 110), lx + 16, y);
    ctx.textAlign = 'right';
    ctx.font = font(11, 'bold');
    ctx.fillText(String(s.value), width - 46, y);
    ctx.font = font(10);
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.fillText(total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%', width - 6, y);
    ctx.globalAlpha = 1;
  });
  return done(canvas, width, height);
}

/* ───────────── Mapa de calor ───────────── */

export function heatmapChart(
  rows: { label: string; cells: (number | null)[]; notes?: (string | null)[] }[],
  columns: string[],
  opts: { width?: number; ramp?: string[]; legend?: [string, string] } = {},
): ChartImage {
  const width = opts.width ?? 760;
  const ramp = opts.ramp ?? BLUE_RAMP;
  const labelW = 86;
  const cellGap = 4;
  const headH = 20;
  const cellH = 30;
  const legendH = 26;
  const height = headH + rows.length * (cellH + cellGap) + legendH + 6;
  const { canvas, ctx } = createCanvas(width, height);
  const max = Math.max(0, ...rows.flatMap((r) => r.cells.map((c) => c ?? 0)));
  const colW = (width - labelW - cellGap * columns.length) / Math.max(1, columns.length);

  ctx.font = font(10, 'bold');
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.textAlign = 'center';
  columns.forEach((c, j) => ctx.fillText(c, labelW + cellGap + j * (colW + cellGap) + colW / 2, headH / 2));

  rows.forEach((row, i) => {
    const y = headH + i * (cellH + cellGap);
    ctx.font = font(11, 'bold');
    ctx.textAlign = 'left';
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.fillText(truncate(ctx, row.label, labelW - 6), 2, y + cellH / 2);
    row.cells.forEach((v, j) => {
      const x = labelW + cellGap + j * (colW + cellGap);
      if (v == null) {
        ctx.strokeStyle = CHART_COLORS.axis;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x + 0.5, y + 0.5, colW - 1, cellH - 1);
        ctx.setLineDash([]);
        return;
      }
      const step = v <= 0 || max <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil((v / max) * 5)));
      ctx.fillStyle = ramp[step];
      ctx.beginPath();
      ctx.roundRect(x, y, colW, cellH, 5);
      ctx.fill();
      ctx.fillStyle = RAMP_TEXT[step];
      ctx.textAlign = 'center';
      const note = row.notes?.[j];
      if (note) {
        ctx.font = font(12, 'bold');
        ctx.fillText(String(v), x + colW / 2, y + cellH / 2 - 5);
        ctx.font = font(8.5);
        ctx.fillText(note, x + colW / 2, y + cellH / 2 + 8);
      } else {
        ctx.font = font(12, 'bold');
        ctx.fillText(String(v), x + colW / 2, y + cellH / 2);
      }
    });
  });

  const ly = height - legendH / 2 - 2;
  ctx.font = font(10);
  ctx.textAlign = 'left';
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.fillText(opts.legend?.[0] ?? 'Menos', 2, ly);
  let lx = 2 + ctx.measureText(opts.legend?.[0] ?? 'Menos').width + 8;
  ramp.forEach((c) => {
    ctx.fillStyle = c;
    ctx.fillRect(lx, ly - 5, 18, 10);
    lx += 21;
  });
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.fillText(opts.legend?.[1] ?? 'Más', lx + 6, ly);
  return done(canvas, width, height);
}
