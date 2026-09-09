import { describe, expect, it } from 'vitest';
import { normalizeTimeHHMM, formatDateKeyLima, toLimaDayBound } from './limaDateTime';

describe('limaDateTime', () => {
  it('normaliza hora HH:mm:ss a HH:mm', () => {
    expect(normalizeTimeHHMM('08:15:00')).toBe('08:15');
    expect(normalizeTimeHHMM('invalid')).toBe('08:00');
  });

  it('devuelve clave de fecha en Lima', () => {
    const key = formatDateKeyLima(new Date('2026-05-29T12:00:00Z'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toLimaDayBound', () => {
  it('devuelve undefined si no hay fecha', () => {
    expect(toLimaDayBound(undefined, false)).toBeUndefined();
    expect(toLimaDayBound('', true)).toBeUndefined();
  });

  it('ancla YYYY-MM-DD al inicio y al fin del día en Lima', () => {
    expect(toLimaDayBound('2026-09-08', false)).toBe('2026-09-08T00:00:00-05:00');
    expect(toLimaDayBound('2026-09-08', true)).toBe('2026-09-08T23:59:59.999-05:00');
  });

  it('no altera timestamps que ya traen hora', () => {
    const iso = '2026-09-08T12:30:00.000Z';
    expect(toLimaDayBound(iso, false)).toBe(iso);
    expect(toLimaDayBound(iso, true)).toBe(iso);
  });
});
