import { describe, expect, it } from 'vitest';
import { normalizeTimeHHMM, formatDateKeyLima } from './limaDateTime';

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
