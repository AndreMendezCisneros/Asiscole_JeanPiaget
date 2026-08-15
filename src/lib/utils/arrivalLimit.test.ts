import { describe, expect, it } from 'vitest';
import {
  compareArrivalStatus,
  normalizeEducationalLevel,
  resolveArrivalLimitForLevel,
  resolveArrivalStatusForStudent,
} from './arrivalLimit';

const limits = {
  general: '08:00',
  primaria: '19:21',
  secundaria: '19:20',
  preuniversitario: '08:10',
};

describe('arrivalLimit', () => {
  it('normaliza Pre-universitario antes que Primaria', () => {
    expect(normalizeEducationalLevel('Pre-universitario')).toBe('Pre-universitario');
    expect(normalizeEducationalLevel('pre_universitario')).toBe('Pre-universitario');
    expect(normalizeEducationalLevel('Primaria')).toBe('Primaria');
    expect(normalizeEducationalLevel('Secundaria')).toBe('Secundaria');
  });

  it('usa límite de primaria, secundaria y pre-universitario por nivel', () => {
    expect(resolveArrivalLimitForLevel(limits, 'Primaria')).toBe('19:21');
    expect(resolveArrivalLimitForLevel(limits, 'Secundaria')).toBe('19:20');
    expect(resolveArrivalLimitForLevel(limits, 'Pre-universitario')).toBe('08:10');
    expect(resolveArrivalLimitForLevel(limits, null)).toBe('08:00');
  });

  it('marca tarde según nivel después del límite', () => {
    expect(resolveArrivalStatusForStudent('19:34', limits, 'Secundaria')).toBe('Tarde');
    expect(resolveArrivalStatusForStudent('19:19', limits, 'Secundaria')).toBe('A tiempo');
    expect(resolveArrivalStatusForStudent('19:22', limits, 'Primaria')).toBe('Tarde');
    expect(resolveArrivalStatusForStudent('07:55', limits, 'Primaria')).toBe('A tiempo');
    expect(resolveArrivalStatusForStudent('08:11', limits, 'Pre-universitario')).toBe('Tarde');
    expect(resolveArrivalStatusForStudent('08:10', limits, 'Pre-universitario')).toBe('A tiempo');
  });

  it('compara horas en formato HH:MM', () => {
    expect(compareArrivalStatus('08:00', '08:00')).toBe('A tiempo');
    expect(compareArrivalStatus('08:01', '08:00')).toBe('Tarde');
  });
});
