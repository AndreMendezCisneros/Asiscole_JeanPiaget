import { describe, expect, it } from 'vitest';
import { buildTutorAttendanceRows, dateKeysBetween } from './tutorAttendance';

describe('dateKeysBetween', () => {
  it('incluye ambos extremos y cruza meses', () => {
    expect(dateKeysBetween('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('rango invertido o inválido → vacío', () => {
    expect(dateKeysBetween('2026-10-05', '2026-10-01')).toEqual([]);
    expect(dateKeysBetween('x', '2026-10-01')).toEqual([]);
  });
});

describe('buildTutorAttendanceRows', () => {
  const students = [
    { id: 1, fullName: 'ALVAREZ, Ana', photo: null },
    { id: 2, fullName: 'BRAVO, Beto', photo: null },
  ];
  // Lun 19 a Vie 23 de octubre de 2026; "hoy" = viernes 23.
  const days = dateKeysBetween('2026-10-19', '2026-10-23');
  const today = '2026-10-23';

  it('cuenta a tiempo, tarde, justificada y falto en días cerrados', () => {
    const rows = buildTutorAttendanceRows(
      students,
      [
        { id_estudiante: 1, fecha: '2026-10-19', hora_llegada: '07:40:00', hora_salida: '13:00:00', estado: 'A tiempo', motivo_justificacion: null },
        { id_estudiante: 1, fecha: '2026-10-20', hora_llegada: '08:10:00', hora_salida: null, estado: 'Tarde', motivo_justificacion: null },
        { id_estudiante: 1, fecha: '2026-10-21', hora_llegada: null, hora_salida: null, estado: 'Falta justificada', motivo_justificacion: 'Cita médica' },
      ],
      days,
      today,
    );
    const ana = rows[0];
    expect(ana.totals.onTime).toBe(1);
    expect(ana.totals.late).toBe(1);
    expect(ana.totals.absentJustified).toBe(1);
    // 22 sin registro y ya cerrado → falto; 23 es hoy → aún sin registro.
    expect(ana.days.find((d) => d.date === '2026-10-22')?.status).toBe('Injustificada');
    expect(ana.days.find((d) => d.date === '2026-10-23')?.status).toBe('Sin_registro');
    expect(ana.days[0].departureTime).toBe('13:00:00');

    const beto = rows[1];
    expect(beto.totals.unjustified).toBe(4);
    expect(beto.days).toHaveLength(5);
  });

  it('con dos filas el mismo día gana la que cuenta como asistencia', () => {
    const rows = buildTutorAttendanceRows(
      [students[0]],
      [
        { id_estudiante: 1, fecha: '2026-10-19', hora_llegada: '07:30:00', hora_salida: null, estado: 'A tiempo', motivo_justificacion: null },
        { id_estudiante: 1, fecha: '2026-10-19', hora_llegada: null, hora_salida: null, estado: 'Falta', motivo_justificacion: null },
      ],
      ['2026-10-19'],
      today,
    );
    expect(rows[0].days[0].status).toBe('A_tiempo');
  });
});
