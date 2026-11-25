import { describe, expect, it } from 'vitest';
import { sortPersonalRows } from './personalSort';

const rows = [
  { personal: { fullName: 'QUISPE, Ana', category: 'Docente Primaria' }, min: 30 },
  { personal: { fullName: 'ÁLVAREZ, Luis', category: 'Administrativo' }, min: 90 },
  { personal: { fullName: 'campos, Rosa', category: 'Administrativo' }, min: 30 },
];
const names = (list: typeof rows) => list.map((r) => r.personal.fullName);
const m = (r: (typeof rows)[number]) => r.min;

describe('sortPersonalRows', () => {
  it('alfabético ignora tildes y mayúsculas', () => {
    expect(names(sortPersonalRows(rows, 'nombre', m))).toEqual(['ÁLVAREZ, Luis', 'campos, Rosa', 'QUISPE, Ana']);
  });

  it('más y menos horas, empate por nombre', () => {
    expect(names(sortPersonalRows(rows, 'mas', m))).toEqual(['ÁLVAREZ, Luis', 'campos, Rosa', 'QUISPE, Ana']);
    expect(names(sortPersonalRows(rows, 'menos', m))).toEqual(['campos, Rosa', 'QUISPE, Ana', 'ÁLVAREZ, Luis']);
  });

  it('por categoría y luego nombre; no modifica la lista original', () => {
    expect(names(sortPersonalRows(rows, 'categoria', m))).toEqual(['ÁLVAREZ, Luis', 'campos, Rosa', 'QUISPE, Ana']);
    expect(names(rows)[0]).toBe('QUISPE, Ana');
  });
});
