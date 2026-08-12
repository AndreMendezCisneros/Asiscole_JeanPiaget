import { describe, expect, it } from 'vitest';
import { incidentsService } from './incidentsService';

describe('incidentsService.mapDBToIncident', () => {
  it('mapea revisado_app del padre en la app', () => {
    const incident = incidentsService.mapDBToIncident({
      id_incidencia: 9,
      id_estudiante: 42,
      id_falta: 3,
      id_usuario_registro: 1,
      fecha_hora_registro: '2026-08-11T21:11:00-05:00',
      observaciones: null,
      nivel_reincidencia: 0,
      estado_evidencia: 'Sin evidencia',
      cantidad_fotos: 0,
      estado: 'Activa',
      revisado_app: true,
      revisado_app_en: '2026-08-11T21:20:00-05:00',
    });

    expect(incident.revisadoApp).toBe(true);
    expect(incident.revisadoAppAt).toBe('2026-08-11T21:20:00-05:00');
  });

  it('sin columnas de revisado queda como no visto', () => {
    const incident = incidentsService.mapDBToIncident({
      id_incidencia: 8,
      id_estudiante: 1,
      id_falta: 2,
      id_usuario_registro: 1,
      fecha_hora_registro: '2026-08-11T19:44:00-05:00',
      observaciones: null,
      nivel_reincidencia: 1,
      estado_evidencia: 'Sin evidencia',
      cantidad_fotos: 0,
      estado: 'Activa',
    });

    expect(incident.revisadoApp).toBe(false);
    expect(incident.revisadoAppAt).toBeNull();
  });
});
