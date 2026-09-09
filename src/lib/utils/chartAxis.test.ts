import { describe, expect, it } from 'vitest';
import { niceAxisScale } from './chartAxis';

describe('niceAxisScale', () => {
  it('usa un techo mínimo de 4 con pasos enteros', () => {
    const { max, ticks } = niceAxisScale(0);
    expect(max).toBeGreaterThanOrEqual(4);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(max);
  });

  it('redondea un máximo irregular a pasos 0-20-40-60-80', () => {
    const { max, ticks } = niceAxisScale(68);
    expect(max).toBe(80);
    expect(ticks).toEqual([0, 20, 40, 60, 80]);
  });

  it('mantiene pasos redondos con un máximo exacto', () => {
    const { max, ticks } = niceAxisScale(40);
    expect(max).toBe(40);
    expect(ticks).toEqual([0, 10, 20, 30, 40]);
  });
});
