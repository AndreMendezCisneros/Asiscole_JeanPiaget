import { describe, expect, it } from 'vitest';
import {
  compareArrivalStatus,
  resolveArrivalLimitForLevel,
  resolveArrivalStatusForStudent,
} from './arrivalLimit';

const limits = {
  general: '08:00',
  primaria: '19:21',
  secundaria: '19:20',
};

describe('arrivalLimit', () => {
  it('usa límite de primaria y secundaria por nivel', () => {
    expect(resolveArrivalLimitForLevel(limits, 'Primaria')).toBe('19:21');
    expect(resolveArrivalLimitForLevel(limits, 'Secundaria')).toBe('19:20');
    expect(resolveArrivalLimitForLevel(limits, null)).toBe('08:00');
  });

  it('marca tarde según nivel después del límite', () => {
    expect(resolveArrivalStatusForStudent('19:34', limits, 'Secundaria')).toBe('Tarde');
    expect(resolveArrivalStatusForStudent('19:19', limits, 'Secundaria')).toBe('A tiempo');
    expect(resolveArrivalStatusForStudent('19:22', limits, 'Primaria')).toBe('Tarde');
    expect(resolveArrivalStatusForStudent('07:55', limits, 'Primaria')).toBe('A tiempo');
  });

  it('compara horas en formato HH:MM', () => {
    expect(compareArrivalStatus('08:00', '08:00')).toBe('A tiempo');
    expect(compareArrivalStatus('08:01', '08:00')).toBe('Tarde');
  });
});
