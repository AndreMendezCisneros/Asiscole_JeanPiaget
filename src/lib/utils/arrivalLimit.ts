import type { EducationalLevel } from '@/types';
import { normalizeTimeValue } from '@/config/systemSettings';

export type ArrivalLimitsByLevel = {
  primaria: string;
  secundaria: string;
  preuniversitario: string;
  /** Respaldo cuando el nivel del estudiante no está definido. */
  general: string;
};

export const DEFAULT_ARRIVAL_LIMITS: ArrivalLimitsByLevel = {
  general: '08:00',
  primaria: '08:00',
  secundaria: '08:00',
  preuniversitario: '08:00',
};

export function withArrivalLimitDefaults(
  partial?: Partial<ArrivalLimitsByLevel> | null,
  fallback = '08:00',
): ArrivalLimitsByLevel {
  const general = normalizeTimeValue(partial?.general, fallback);
  return {
    general,
    primaria: normalizeTimeValue(partial?.primaria, general),
    secundaria: normalizeTimeValue(partial?.secundaria, general),
    preuniversitario: normalizeTimeValue(partial?.preuniversitario, general),
  };
}

/** Normaliza nivel educativo del estudiante. Pre-universitario antes de prim/sec. */
export function normalizeEducationalLevel(
  level?: string | null
): EducationalLevel | null {
  const l = (level ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');
  if (l.includes('preuniv')) return 'Pre-universitario';
  if (l.includes('prim')) return 'Primaria';
  if (l.includes('sec')) return 'Secundaria';
  return null;
}

export function arrivalLimitConfigKey(level?: string | null): string {
  const nivel = normalizeEducationalLevel(level);
  if (nivel === 'Pre-universitario') return 'hora_limite_llegada_preuniversitario';
  if (nivel === 'Primaria') return 'hora_limite_llegada_primaria';
  if (nivel === 'Secundaria') return 'hora_limite_llegada_secundaria';
  return 'hora_limite_llegada';
}

export function resolveArrivalLimitForLevel(
  limits: ArrivalLimitsByLevel,
  level?: string | null
): string {
  const nivel = normalizeEducationalLevel(level);
  if (nivel === 'Pre-universitario') return limits.preuniversitario;
  if (nivel === 'Primaria') return limits.primaria;
  if (nivel === 'Secundaria') return limits.secundaria;
  return limits.general;
}

/** Estado según hora de llegada y nivel. */
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
