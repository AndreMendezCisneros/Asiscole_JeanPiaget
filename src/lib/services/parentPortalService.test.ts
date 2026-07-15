import { describe, expect, it } from 'vitest';
import { parseStudentIdsFromGrados } from '@/lib/services/parentPortalService';

describe('parseStudentIdsFromGrados', () => {
  it('lee studentIds desde JSON en usuarios.grados_asignados', () => {
    expect(parseStudentIdsFromGrados({ studentIds: [32, 31] })).toEqual([32, 31]);
  });

  it('parsea string JSON', () => {
    expect(parseStudentIdsFromGrados('{"studentIds":[32,31]}')).toEqual([32, 31]);
  });

  it('acepta array numérico directo', () => {
    expect(parseStudentIdsFromGrados([32, 31])).toEqual([32, 31]);
  });

  it('devuelve vacío si no hay ids', () => {
    expect(parseStudentIdsFromGrados(null)).toEqual([]);
    expect(parseStudentIdsFromGrados({})).toEqual([]);
  });
});
