import type { EducationalLevel } from '@/types';
import { normalizeTimeValue } from '@/config/systemSettings';

export type ArrivalLimitsByLevel = {
  primaria: string;
  secundaria: string;
  /** Respaldo cuando el nivel del estudiante no está definido. */
  general: string;
};

/** Normaliza nivel educativo del estudiante. */
export function normalizeEducationalLevel(
  level?: string | null
): EducationalLevel | null {
  const l = (level ?? '').trim().toLowerCase();
  if (l.includes('prim')) return 'Primaria';
  if (l.includes('sec')) return 'Secundaria';
  return null;
}

export function arrivalLimitConfigKey(level?: string | null): string {
  const nivel = normalizeEducationalLevel(level);
  if (nivel === 'Primaria') return 'hora_limite_llegada_primaria';
  if (nivel === 'Secundaria') return 'hora_limite_llegada_secundaria';
  return 'hora_limite_llegada';
}

export function resolveArrivalLimitForLevel(
  limits: ArrivalLimitsByLevel,
  level?: string | null
): string {
  const nivel = normalizeEducationalLevel(level);
  if (nivel === 'Primaria') return limits.primaria;
  if (nivel === 'Secundaria') return limits.secundaria;
  return limits.general;
}

/** Estado según hora de llegada y nivel (primaria / secundaria). */
export function resolveArrivalStatusForStudent(
  arrivalTime: string,
  limits: ArrivalLimitsByLevel,
  level?: string | null
): 'A tiempo' | 'Tarde' {
  const limit = resolveArrivalLimitForLevel(limits, level);
  return compareArrivalStatus(arrivalTime, limit);
}

function timeToMinutes(hhmm: string): number {
  const t = normalizeTimeValue(hhmm, '00:00');
  const [h, m] = t.split(':').map((v) => parseInt(v, 10));
  return h * 60 + (m || 0);
}

export function compareArrivalStatus(
  arrivalTime: string,
  limit: string
): 'A tiempo' | 'Tarde' {
  return timeToMinutes(arrivalTime) <= timeToMinutes(limit) ? 'A tiempo' : 'Tarde';
}
