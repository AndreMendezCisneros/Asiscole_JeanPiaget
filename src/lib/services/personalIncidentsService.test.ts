import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({ supabase: {} }));

import {
  joinAutoObservation,
  personalFaultLabel,
  resolveRegisteredByName,
  splitAutoObservation,
} from './personalIncidentsService';

describe('resolveRegisteredByName', () => {
  it('usa el nombre guardado al registrar (RRHH no lee usuarios)', () => {
    expect(
      resolveRegisteredByName({ registrado_por_nombre: 'Jhoel Lope', usuarios_registro: null, observaciones: 'x' }),
    ).toBe('Jhoel Lope');
  });

  it('usa el usuario enlazado si no hay nombre guardado', () => {
    expect(
      resolveRegisteredByName({
        registrado_por_nombre: null,
        usuarios_registro: { nombre_completo: 'Mary Quicaña' },
        observaciones: null,
      }),
    ).toBe('Mary Quicaña');
  });

  it('marca las automáticas como del sistema', () => {
    expect(
      resolveRegisteredByName({
        registrado_por_nombre: null,
        usuarios_registro: null,
        observaciones: 'Generada automáticamente: no registró llegada',
      }),
    ).toBe('Sistema (automática)');
  });

  it('devuelve null si no hay dato', () => {
    expect(resolveRegisteredByName({ registrado_por_nombre: '  ', usuarios_registro: null, observaciones: null })).toBeNull();
  });
});

describe('personalFaultLabel', () => {
  it('muestra «Falta» como «Inasistencia» y deja las demás', () => {
    expect(personalFaultLabel('Falta')).toBe('Inasistencia');
    expect(personalFaultLabel(' falta ')).toBe('Inasistencia');
    expect(personalFaultLabel('Falta de respeto')).toBe('Falta de respeto');
  });
});

describe('split/joinAutoObservation', () => {
  const auto = 'Generada automáticamente: sin registro de entrada 120 min después de su hora de entrada.';

  it('observación manual: todo es editable', () => {
    expect(splitAutoObservation('Llegó tarde')).toEqual({ prefix: '', note: 'Llegó tarde' });
    expect(joinAutoObservation('', '  ')).toBeNull();
    expect(joinAutoObservation('', ' Nota ')).toBe('Nota');
  });

  it('automática: el prefijo se conserva y solo se edita la nota', () => {
    expect(splitAutoObservation(auto)).toEqual({ prefix: auto, note: '' });
    const withNote = `${auto} Avisó por teléfono`;
    expect(splitAutoObservation(withNote)).toEqual({ prefix: auto, note: 'Avisó por teléfono' });
    expect(joinAutoObservation(auto, 'Otra nota')).toBe(`${auto} Otra nota`);
    expect(joinAutoObservation(auto, '')).toBe(auto);
  });

  it('null queda vacío', () => {
    expect(splitAutoObservation(null)).toEqual({ prefix: '', note: '' });
  });
});
