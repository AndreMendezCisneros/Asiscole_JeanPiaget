import { describe, expect, it } from 'vitest';
import { computeAusentes } from './pensionesMatch';

const impagos = [
  { idEstudiante: 1, nombreEstudiante: 'QUISPE ARAMBURU, FABRICIO MATTEO' },
  { idEstudiante: 2, nombreEstudiante: 'SANCHEZ CARDENAS, EMILY' },
  { idEstudiante: 3, nombreEstudiante: 'CORDOVA YARANGA, TEO ADRIAN' },
];

describe('computeAusentes', () => {
  it('cierra a quien ya no sale y protege nombres de filas sin match', () => {
    const res = computeAusentes(impagos, [3], ['SANCHEZ CARDENAS, EMILY ']);
    expect(res.ausentes.map((r) => r.idEstudiante)).toEqual([1]);
    expect(res.protegidos.map((r) => r.idEstudiante)).toEqual([2]);
  });

  it('sin filas dudosas, todos los que no hicieron match son ausentes', () => {
    const res = computeAusentes(impagos, [], []);
    expect(res.ausentes).toHaveLength(3);
    expect(res.protegidos).toHaveLength(0);
  });
});
