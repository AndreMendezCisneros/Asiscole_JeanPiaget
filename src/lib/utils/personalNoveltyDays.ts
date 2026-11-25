import type { PersonalArrivalRecord } from '@/types/personal';

type NoveltyFields = Pick<
  PersonalArrivalRecord,
  'status' | 'departureType' | 'justificationReason' | 'departureReason'
>;

/**
 * Día "con novedad" para el PDF integral de varios meses: todo lo que no sea un día
 * normal (llegó a tiempo y salió normal sin motivos). Tardanzas, inasistencias,
 * justificaciones, fuera de horario, salidas anticipadas/autorizadas o cierre automático.
 */
export function isNoveltyDay(r: NoveltyFields): boolean {
  if (r.status !== 'A tiempo') return true;
  if (r.departureType === 'Anticipada' || r.departureType === 'Autorizada') return true;
  if (r.justificationReason?.trim()) return true;
  if (r.departureReason?.trim()) return true;
  return false;
}

export function noveltyDays<T extends NoveltyFields>(records: T[]): T[] {
  return records.filter(isNoveltyDay);
}
