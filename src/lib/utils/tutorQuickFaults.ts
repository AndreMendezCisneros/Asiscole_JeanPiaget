/** Faltas que el tutor ve como reporte rápido al escanear. */
export const TUTOR_QUICK_FAULT_NAMES = [
  'No porta carnet institucional',
  'Presentación personal inadecuada',
  'Cabello largo',
  'Asistió con buzo',
  'Uñas fuera de la normativa',
  'Uso de prendas no autorizadas',
] as const;

export function normalizeFaultName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreNameMatch(candidate: string, target: string): number {
  if (candidate === target) return 0;
  if (candidate.includes(target) || target.includes(candidate)) {
    return Math.abs(candidate.length - target.length) + 1;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Elige hasta 6 faltas activas según TUTOR_QUICK_FAULT_NAMES.
 * No rellena con otras del catálogo: si una no existe, ese cuadro no aparece.
 */
export function pickTutorQuickFaults<T extends { name: string; active?: boolean }>(
  faults: T[],
  limit = TUTOR_QUICK_FAULT_NAMES.length,
): T[] {
  const available = faults.filter((fault) => fault.active !== false);
  const unused = new Set(available);
  const picked: T[] = [];

  for (const preferred of TUTOR_QUICK_FAULT_NAMES) {
    if (picked.length >= limit) break;
    const target = normalizeFaultName(preferred);
    let best: T | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const fault of unused) {
      const score = scoreNameMatch(normalizeFaultName(fault.name), target);
      if (score < bestScore) {
        best = fault;
        bestScore = score;
      }
    }

    if (best && Number.isFinite(bestScore)) {
      picked.push(best);
      unused.delete(best);
    }
  }

  return picked;
}
