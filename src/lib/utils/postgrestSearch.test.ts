import { describe, expect, it } from 'vitest';
import { ilikeContainsValue, studentSearchOrFilter } from './postgrestSearch';

describe('ilikeContainsValue', () => {
  it('pone el texto entre comillas para que comas y paréntesis no rompan el filtro', () => {
    expect(ilikeContainsValue('PEREZ, JUAN (2do)')).toBe('"%PEREZ, JUAN (2do)%"');
  });

  it('escapa comodines, comillas y barras', () => {
    // LIKE: a\_b\%c → dentro de comillas cada barra va escapada
    expect(ilikeContainsValue('a_b%c')).toBe('"%a\\\\_b\\\\%c%"');
    expect(ilikeContainsValue('O"Neil')).toBe('"%O\\"Neil%"');
  });
});

describe('studentSearchOrFilter', () => {
  it('busca por nombre o código con el mismo valor', () => {
    expect(studentSearchOrFilter('  ana ')).toBe('nombre_completo.ilike."%ana%",codigo_barras.ilike."%ana%"');
  });
});
