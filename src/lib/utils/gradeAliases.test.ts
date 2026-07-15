import { describe, expect, it } from 'vitest';
import { gradeFilterValues } from './gradeAliases';

describe('gradeFilterValues', () => {
  it('incluye alias numérico para grados ordinales', () => {
    expect(gradeFilterValues('4to')).toEqual(['4to', '4']);
    expect(gradeFilterValues('1ro')).toEqual(['1ro', '1']);
  });

  it('devuelve el grado tal cual si no hay alias', () => {
    expect(gradeFilterValues('Inicial')).toEqual(['Inicial']);
  });
});
