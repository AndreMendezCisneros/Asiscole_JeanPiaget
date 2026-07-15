import { describe, expect, it } from 'vitest';
import {
  computeConstantIntervalMs,
  evaluateLoadThresholds,
  percentile,
  summarizeLoad,
} from './metrics';

describe('computeConstantIntervalMs', () => {
  it('reparte 10 000 peticiones en 30 minutos (~180 ms)', () => {
    const interval = computeConstantIntervalMs(10_000, 30 * 60 * 1000);
    expect(interval).toBeCloseTo(180, 5);
  });

  it('devuelve 0 si duration es 0', () => {
    expect(computeConstantIntervalMs(100, 0)).toBe(0);
  });
});

describe('percentile', () => {
  it('calcula p95 correctamente', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(data, 95)).toBe(95);
    expect(percentile(data, 50)).toBe(50);
  });
});

describe('summarizeLoad', () => {
  it('resume latencias y errores', () => {
    const summary = summarizeLoad(
      [
        { ok: true, latencyMs: 100 },
        { ok: true, latencyMs: 200 },
        { ok: false, latencyMs: 500, error: 'timeout' },
      ],
      30_000
    );

    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errorsByType.timeout).toBe(1);
    expect(summary.latencyMs.avg).toBeCloseTo(266.67, 1);
  });
});

describe('evaluateLoadThresholds', () => {
  it('aprueba carga saludable', () => {
    const summary = summarizeLoad(
      Array.from({ length: 100 }, () => ({ ok: true, latencyMs: 120 })),
      60_000
    );
    expect(evaluateLoadThresholds(summary).pass).toBe(true);
  });

  it('rechaza si p95 supera umbral', () => {
    const summary = summarizeLoad(
      [
        ...Array.from({ length: 90 }, () => ({ ok: true, latencyMs: 100 })),
        ...Array.from({ length: 10 }, () => ({ ok: true, latencyMs: 5000 })),
      ],
      60_000
    );
    const result = evaluateLoadThresholds(summary, { maxP95Ms: 3000 });
    expect(result.pass).toBe(false);
    expect(result.reasons.some((r) => r.includes('p95'))).toBe(true);
  });
});
