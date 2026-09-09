import { describe, expect, it } from 'vitest';
import type { Student } from '@/types';
import {
  foldSearchText,
  orderSearchTokensBySelectivity,
  scoreStudentSearchMatch,
  studentMatchesSearchTokens,
  studentMatchesNameOrClassroom,
  tokenizeSearchQuery,
} from './studentSearch';

const sample: Student = {
  id: 1,
  fullName: 'Nick Rey Yefer Huamani Espinoza',
  grade: '4to',
  section: 'A',
  level: 'Secundaria',
  barcode: '76127901',
  profilePhoto: null,
  reincidenceLevel: 0,
  faultsLast60Days: 0,
  active: true,
  contactPhone: null,
  contactEmail: null,
  responsibleName: null,
  responsibleRelationship: null,
  emergencyPhone: null,
};

describe('studentSearch', () => {
  it('tokeniza palabras de al menos 2 caracteres', () => {
    expect(tokenizeSearchQuery('huamani rey')).toEqual(['huamani', 'rey']);
  });

  it('coincide con cada palabra aunque no estén juntas en el nombre', () => {
    expect(studentMatchesSearchTokens(sample, ['huamani', 'rey'])).toBe(true);
    expect(studentMatchesSearchTokens(sample, ['espinoza', 'nick'])).toBe(true);
    expect(studentMatchesSearchTokens(sample, ['garcia'])).toBe(false);
  });

  it('coincide con dos apellidos (espino escriba)', () => {
    const jeremi: Student = {
      ...sample,
      id: 2,
      fullName: 'Jeremi Isac Espino Escriba',
      barcode: '70391919',
    };
    expect(studentMatchesSearchTokens(jeremi, ['espino', 'escriba'])).toBe(true);
  });

  it('ordena tokens largos primero para busquedas mas selectivas', () => {
    expect(orderSearchTokensBySelectivity(['espino', 'escriba'])[0]).toBe('escriba');
  });

  it('ignora acentos al comparar', () => {
    expect(foldSearchText('José')).toBe('jose');
    expect(studentMatchesSearchTokens({ ...sample, fullName: 'José García' }, ['jose'])).toBe(true);
  });

  it('busca por nombre, aula o DNI', () => {
    expect(studentMatchesNameOrClassroom(sample, 'huamani')).toBe(true);
    expect(studentMatchesNameOrClassroom(sample, '4to A')).toBe(true);
    expect(studentMatchesNameOrClassroom(sample, 'secundaria 4to')).toBe(true);
    expect(studentMatchesNameOrClassroom(sample, '76127901')).toBe(true);
    expect(studentMatchesNameOrClassroom(sample, 'jose')).toBe(false);
  });

  it('prioriza apellido exacto', () => {
    const apellido = scoreStudentSearchMatch(sample, ['espinoza']);
    const nombre = scoreStudentSearchMatch(sample, ['nick']);
    expect(apellido).toBeGreaterThan(nombre);
  });
});
