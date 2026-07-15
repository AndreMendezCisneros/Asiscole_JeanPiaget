import { describe, expect, it } from 'vitest';

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round) as [
    number,
    number,
    number,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channels = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg) + 0.05;
  const l2 = relativeLuminance(bg) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

/** Valores canónicos en src/index.css (:root) */
const LOGIN_TOKENS = {
  deep: [232, 30, 5] as const,
  elevated: [228, 18, 13] as const,
  muted: [216, 20, 83] as const,
  caption: [216, 16, 75] as const,
  placeholder: [216, 14, 65] as const,
};

describe('login contrast tokens (WCAG AA)', () => {
  it('texto secundario cumple 4.5:1 sobre fondo oscuro', () => {
    const fg = hslToRgb(...LOGIN_TOKENS.muted);
    const bg = hslToRgb(...LOGIN_TOKENS.deep);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('caption cumple 4.5:1 sobre fondo oscuro', () => {
    const fg = hslToRgb(...LOGIN_TOKENS.caption);
    const bg = hslToRgb(...LOGIN_TOKENS.deep);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('placeholder cumple 4.5:1 sobre input elevado', () => {
    const fg = hslToRgb(...LOGIN_TOKENS.placeholder);
    const bg = hslToRgb(...LOGIN_TOKENS.elevated);
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
