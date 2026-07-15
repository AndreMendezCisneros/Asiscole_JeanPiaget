export interface RequestSample {
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
}

export interface LoadSummary {
  total: number;
  ok: number;
  failed: number;
  successRate: number;
  durationMs: number;
  rps: number;
  latencyMs: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorsByType: Record<string, number>;
}

/** Intervalo constante entre peticiones para repartir N requests en durationMs. */
export function computeConstantIntervalMs(totalRequests: number, durationMs: number): number {
  if (totalRequests <= 0) return durationMs;
  if (durationMs <= 0) return 0;
  return durationMs / totalRequests;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const clamped = Math.min(100, Math.max(0, p));
  const index = Math.ceil((clamped / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, index)] ?? 0;
}

export function summarizeLoad(samples: RequestSample[], durationMs: number): LoadSummary {
  const total = samples.length;
  const ok = samples.filter((s) => s.ok).length;
  const failed = total - ok;
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const sum = latencies.reduce((acc, n) => acc + n, 0);

  const errorsByType: Record<string, number> = {};
  for (const s of samples) {
    if (s.ok) continue;
    const key = s.error || `HTTP ${s.status ?? 'unknown'}`;
    errorsByType[key] = (errorsByType[key] ?? 0) + 1;
  }

  return {
    total,
    ok,
    failed,
    successRate: total > 0 ? (ok / total) * 100 : 0,
    durationMs,
    rps: durationMs > 0 ? total / (durationMs / 1000) : 0,
    latencyMs: {
      min: latencies[0] ?? 0,
      max: latencies[latencies.length - 1] ?? 0,
      avg: total > 0 ? sum / total : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    },
    errorsByType,
  };
}

/** ¿Aguanta la carga según umbrales operativos del SIE? */
export function evaluateLoadThresholds(
  summary: LoadSummary,
  opts: { minSuccessRate?: number; maxP95Ms?: number } = {}
): { pass: boolean; reasons: string[] } {
  const minSuccessRate = opts.minSuccessRate ?? 99;
  const maxP95Ms = opts.maxP95Ms ?? 3000;
  const reasons: string[] = [];

  if (summary.successRate < minSuccessRate) {
    reasons.push(
      `Tasa de éxito ${summary.successRate.toFixed(2)}% < ${minSuccessRate}%`
    );
  }
  if (summary.latencyMs.p95 > maxP95Ms) {
    reasons.push(`p95 ${summary.latencyMs.p95.toFixed(0)} ms > ${maxP95Ms} ms`);
  }

  return { pass: reasons.length === 0, reasons };
}
