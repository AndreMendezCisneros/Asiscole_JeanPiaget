import { describe, expect, it } from 'vitest';
import { incidentMatchesRevisadoFilter, revisadoAppEstado } from './revisadoAppEstado';

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

  it('confirma aunque no haya flag de visto', () => {
    expect(revisadoAppEstado({ revisadoApp: false, confirmadaApp: true })).toBe('confirmado');
  });
});

describe('incidentMatchesRevisadoFilter', () => {
  const no = { revisadoApp: false, confirmadaApp: false };
  const visto = { revisadoApp: true, confirmadaApp: false };
  const confirmado = { revisadoApp: true, confirmadaApp: true };

  it('con all o sin filtro incluye cualquier estado', () => {
    expect(incidentMatchesRevisadoFilter(no, 'all')).toBe(true);
    expect(incidentMatchesRevisadoFilter(visto)).toBe(true);
    expect(incidentMatchesRevisadoFilter(confirmado, 'all')).toBe(true);
  });

  it('alinea los filtros de /incidents: no, visto y confirmado', () => {
    expect(incidentMatchesRevisadoFilter(no, 'no')).toBe(true);
    expect(incidentMatchesRevisadoFilter(visto, 'no')).toBe(false);
    expect(incidentMatchesRevisadoFilter(confirmado, 'no')).toBe(false);

    expect(incidentMatchesRevisadoFilter(visto, 'visto')).toBe(true);
    expect(incidentMatchesRevisadoFilter(no, 'visto')).toBe(false);
    expect(incidentMatchesRevisadoFilter(confirmado, 'visto')).toBe(false);

    expect(incidentMatchesRevisadoFilter(confirmado, 'confirmado')).toBe(true);
    expect(incidentMatchesRevisadoFilter(visto, 'confirmado')).toBe(false);
    expect(incidentMatchesRevisadoFilter(no, 'confirmado')).toBe(false);
  });
});
