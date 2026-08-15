import { describe, expect, it } from 'vitest';
import { gradeFilterValues } from './gradeAliases';

describe('gradeFilterValues', () => {
  it('devuelve el valor exacto del piso', () => {
    expect(gradeFilterValues('2002')).toEqual(['2002']);
    expect(gradeFilterValues('4to')).toEqual(['4to']);
  });

  it('ignora espacios y no inventa alias numéricos', () => {
    expect(gradeFilterValues(' 2010 ')).toEqual(['2010']);
    expect(gradeFilterValues('')).toEqual([]);
  });
});
