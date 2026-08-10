import { describe, expect, it } from 'vitest';
import { matchPensionCandidate } from './pensionesMatch';

describe('matchPensionCandidate', () => {
  const students = [
    { id: 1, barcode: '01234567', fullName: 'PEREZ GOMEZ ANA' },
    { id: 2, barcode: '87654321', fullName: 'LOPEZ RUIZ JUAN' },
  ];

  it('match por DNI sin cero', () => {
    const r = matchPensionCandidate({ rawDni: '1234567', rawNombre: null }, students);
    expect(r.status).toBe('ok');
    expect(r.idEstudiante).toBe(1);
  });

  it('match por nombre normalizado', () => {
    const r = matchPensionCandidate(
      { rawDni: null, rawNombre: 'Pérez Gómez Ana' },
      students,
    );
    expect(r.status).toBe('ok');
    expect(r.idEstudiante).toBe(1);
  });

  it('sin match', () => {
    const r = matchPensionCandidate({ rawDni: '999', rawNombre: 'NADIE' }, students);
    expect(r.status).toBe('sin_match');
  });
});
