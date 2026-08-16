import { describe, expect, it } from 'vitest';
import {
  buildArrivalIngestBody,
  buildCitaIngestBody,
  buildDepartureIngestBody,
  buildIncidentIngestBody,
  buildNotaIngestBody,
  citaAlcanceFromMeetingTipo,
} from './mobileIngest';
import type { ArrivalRecord, FaultType, Incident, Student } from '@/types';

const student: Student = {
  id: 10,
  fullName: 'Ana Pérez',
  grade: '3',
  section: 'A',
  level: 'Primaria',
  barcode: 'X',
  reincidenceLevel: 0,
  faultsLast60Days: 0,
  active: true,
};

describe('mobileIngest builders', () => {
  it('arma body de entrada como el ejemplo de la API móvil', () => {
    const record: ArrivalRecord = {
      id: 1042,
      studentId: 10,
      date: '2026-07-26',
      arrivalTime: '07:45',
      status: 'A tiempo',
    };
    expect(buildArrivalIngestBody('jean_piaget', student, record)).toEqual({
      tenant_id: 'jean_piaget',
      tipo: 'entrada',
      id_estudiante: 10,
      id_registro: 1042,
      payload: {
        nombre_completo: 'Ana Pérez',
        grado: '3',
        seccion: 'A',
        nivel_educativo: 'Primaria',
        fecha: '2026-07-26',
        hora_llegada: '07:45',
        estado: 'A tiempo',
      },
    });
  });

  it('arma body de salida con hora_salida', () => {
    const record: ArrivalRecord = {
      id: 200,
      studentId: 10,
      date: '2026-07-26',
      departureTime: '13:10',
      departureType: 'Normal',
    };
    const body = buildDepartureIngestBody('jean_piaget', student, record);
    expect(body.tipo).toBe('salida');
    expect(body.payload.hora_salida).toBe('13:10');
  });

  it('arma body de incidencia con nombre_falta', () => {
    const incident: Incident = {
      id: 8,
      studentId: 10,
      faultTypeId: 1,
      registeredBy: 1,
      registeredAt: '2026-07-26T14:30:00.000Z',
      observations: null,
      reincidenceLevel: 0,
      hasEvidence: false,
      evidenceCount: 0,
      status: 'Activa',
    };
    const fault: FaultType = {
      id: 1,
      name: 'No porta carné',
      category: 'Uniforme',
      severity: 'Leve',
      points: 1,
      active: true,
    };
    const body = buildIncidentIngestBody('jean_piaget', student, incident, fault);
    expect(body.tipo).toBe('incidencia');
    expect(body.payload.nombre_falta).toBe('No porta carné');
    expect(body.id_registro).toBe(8);
  });

  it('arma registro de nota estructurado para la sección de la app', () => {
    const body = buildNotaIngestBody('asis_academy', student, {
      semanaCodigo: '2026-02',
      semanaEtiqueta: 'Semana 2',
      nota: 18.5,
      carreraNombre: 'Medicina Humana',
      areaNombre: 'Ciencias de la Salud',
      areaCodigo: 'salud',
      fechaInicio: '2026-02-03',
      fechaFin: '2026-02-09',
      idRegistro: 991,
    });
    expect(body.tipo).toBe('nota');
    expect(body.id_registro).toBe(991);
    expect(body.payload.nota).toBe('18.5');
    expect(body.payload.nota_maxima).toBe('20');
    expect(body.payload.semana_codigo).toBe('2026-02');
    expect(body.payload.area_codigo).toBe('salud');
    expect(body.payload.area_nombre).toBe('Ciencias de la Salud');
    expect(body.payload.carrera).toBe('Medicina Humana');
    expect(body.payload.fecha_inicio).toBe('2026-02-03');
    expect(body.payload.fecha_fin).toBe('2026-02-09');
    expect(body.payload.semana_etiqueta).toBe('Semana 2');
    expect(body.payload.texto_libre).toContain('18.5/20');
    expect(body.payload.texto_libre).toContain('Medicina Humana');
  });

  it('arma aviso de citación individual como pensión', () => {
    const body = buildCitaIngestBody('asis_academy', student, {
      citaId: 44,
      motivo: 'Revisión de incidencias',
      fecha: '2026-08-20',
      hora: '09:30',
      alcance: 'individual',
    });
    expect(body.tipo).toBe('aviso');
    expect(body.id_registro).toBe(44);
    expect(body.payload.contexto).toBe('cita');
    expect(body.payload.alcance).toBe('individual');
    expect(body.payload.fecha).toBe('2026-08-20');
    expect(body.payload.hora).toBe('09:30');
    expect(body.payload.texto_libre).toContain('Se citó a los padres de Ana Pérez');
    expect(body.payload.texto_libre).toContain('20/08/2026');
  });

  it('cambia el texto según APAFA, piso y salón', () => {
    expect(citaAlcanceFromMeetingTipo('all')).toBe('apafa');
    expect(citaAlcanceFromMeetingTipo('grade')).toBe('piso');
    expect(citaAlcanceFromMeetingTipo('section')).toBe('salon');
    const apafa = buildCitaIngestBody('asis_academy', student, {
      citaId: 1,
      motivo: 'Junta',
      fecha: '2026-08-21',
      hora: '10:00',
      alcance: 'apafa',
    });
    expect(apafa.payload.texto_libre).toContain('junta de padres (APAFA)');
    const piso = buildCitaIngestBody('asis_academy', student, {
      citaId: 2,
      motivo: 'Reunión de piso',
      fecha: '2026-08-21',
      hora: '10:00',
      alcance: 'piso',
    });
    expect(piso.payload.texto_libre).toContain('piso 3');
  });
});
