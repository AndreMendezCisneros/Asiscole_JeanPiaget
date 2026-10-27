import { describe, expect, it } from 'vitest';
import { computeAusentes, matchPensionCandidate } from './pensionesMatch';

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

const nomina = [
  { id: 1, barcode: '01234567', fullName: 'MALLCCO GUILLEN VLADIMIR PABLO ANTONIO' },
  { id: 2, barcode: '63342217', fullName: 'HUERTAS LOAYZA NHARELY MAILIANG' },
  { id: 3, barcode: '79682782', fullName: 'HUERTAS LOAYZA JHOMAYRA JULIETH AMIRA' },
  { id: 4, barcode: '90353671', fullName: 'QUISPE ARAMBURU BRIANNA KHALEESI' },
  { id: 5, barcode: '91288850', fullName: 'QUISPE ARAMBURU FABRICIO MATTEO ALEXANDER' },
  { id: 6, barcode: '70000001', fullName: 'PEREZ RUIZ JUAN CARLOS' },
  { id: 7, barcode: '70000002', fullName: 'PEREZ RUIZ JUAN PABLO' },
];

describe('matchPensionCandidate', () => {
  it('encuentra por DNI aunque falten ceros a la izquierda', () => {
    const res = matchPensionCandidate({ rawDni: '1234567', rawNombre: null }, nomina);
    expect(res).toMatchObject({ status: 'ok', idEstudiante: 1, metodo: 'dni' });
  });

  it('si el DNI no existe, busca por nombre aunque el Excel traiga menos nombres', () => {
    const res = matchPensionCandidate(
      { rawDni: '99999999', rawNombre: 'MALLCCO GUILLEN, VLADIMIR PABLO' },
      nomina,
    );
    expect(res).toMatchObject({ status: 'ok', idEstudiante: 1, metodo: 'nombre' });
  });

  it('no confunde hermanos con los mismos apellidos', () => {
    const res = matchPensionCandidate(
      { rawDni: '91806591', rawNombre: 'HUERTAS LOAYZA, edric lumer' },
      nomina,
    );
    expect(res.status).toBe('sin_match');
  });

  it('si el nombre corto encaja en dos alumnos, queda ambiguo', () => {
    const res = matchPensionCandidate({ rawDni: null, rawNombre: 'PEREZ RUIZ, JUAN' }, nomina);
    expect(res.status).toBe('ambiguo');
  });

  it('con DNI repetido, el nombre decide', () => {
    const dup = [
      ...nomina,
      { id: 8, barcode: '90353671', fullName: 'OTRO ALUMNO CON DNI REPETIDO' },
    ];
    const res = matchPensionCandidate(
      { rawDni: '90353671', rawNombre: 'QUISPE ARAMBURU, BRIANNA' },
      dup,
    );
    expect(res).toMatchObject({ status: 'ok', idEstudiante: 4, metodo: 'nombre' });
  });
});
