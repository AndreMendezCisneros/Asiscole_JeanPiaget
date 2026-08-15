import { describe, expect, it } from 'vitest';
import { revisadoAppEstado } from './revisadoAppEstado';

describe('revisadoAppEstado', () => {
  it('prioriza la confirmación de la página Incidencias', () => {
    expect(revisadoAppEstado({ revisadoApp: true, confirmadaApp: true })).toBe('confirmado');
  });

  it('marca visto si solo leyó el mensaje', () => {
    expect(revisadoAppEstado({ revisadoApp: true, confirmadaApp: false })).toBe('visto');
  });

  it('queda no si no hay señal de la app', () => {
    expect(revisadoAppEstado({})).toBe('no');
  });
});
