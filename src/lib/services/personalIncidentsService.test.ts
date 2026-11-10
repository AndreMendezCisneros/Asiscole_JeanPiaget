import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseClient', () => ({ supabase: {} }));

import { resolveRegisteredByName } from './personalIncidentsService';

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
