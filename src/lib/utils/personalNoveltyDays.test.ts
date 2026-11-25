import { describe, expect, it } from 'vitest';
import { isNoveltyDay, noveltyDays } from './personalNoveltyDays';

const base = {
  status: 'A tiempo' as const,
  departureType: 'Normal' as const,
  justificationReason: null,
  departureReason: null,
};

describe('isNoveltyDay', () => {
  it('día normal a tiempo no es novedad', () => {
    expect(isNoveltyDay(base)).toBe(false);
  });

  it('tardanza, inasistencia y fuera de horario son novedad', () => {
    expect(isNoveltyDay({ ...base, status: 'Tarde' })).toBe(true);
    expect(isNoveltyDay({ ...base, status: 'Falta' })).toBe(true);
    expect(isNoveltyDay({ ...base, status: 'Falta justificada' })).toBe(true);
    expect(isNoveltyDay({ ...base, status: 'Fuera de horario' })).toBe(true);
  });

  it('salida anticipada o autorizada es novedad aunque llegó a tiempo', () => {
    expect(isNoveltyDay({ ...base, departureType: 'Anticipada' })).toBe(true);
    expect(isNoveltyDay({ ...base, departureType: 'Autorizada' })).toBe(true);
  });

  it('con motivo (p. ej. cierre automático) es novedad', () => {
    expect(isNoveltyDay({ ...base, departureReason: 'Cierre automático: no marcó salida' })).toBe(true);
    expect(isNoveltyDay({ ...base, justificationReason: '  ' })).toBe(false);
  });

  it('noveltyDays filtra la lista', () => {
    expect(noveltyDays([base, { ...base, status: 'Tarde' }])).toHaveLength(1);
  });
});
