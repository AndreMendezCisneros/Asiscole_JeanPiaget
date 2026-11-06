import { describe, expect, it } from 'vitest';
import { computeOvertime } from './personalOvertime';
import type { Personal, PersonalArrivalRecord, PersonalTallerRecord } from '@/types/personal';

const base: Personal = {
  id: 1,
  barcode: '12345678',
  fullName: 'PRUEBA, Ana',
  category: 'Docente Primaria',
  position: null,
  birthDate: null,
  address: null,
  phone: null,
  email: null,
  profilePhoto: null,
  active: true,
  createdAt: '2026-10-01',
  // Lunes a viernes 08:00–14:00
  schedule: [1, 2, 3, 4, 5].map((d) => ({ day: d as 1, entry: '08:00', exit: '14:00' })),
};

// 2026-11-02 es lunes; 2026-11-07 es sábado.
const MONDAY = '2026-11-02';
const SATURDAY = '2026-11-07';
const TODAY = '2026-11-20';

function rec(extra: Partial<PersonalArrivalRecord> = {}): PersonalArrivalRecord {
  return {
    id: 1,
    personalId: 1,
    date: MONDAY,
    arrivalTime: '08:00',
    status: 'A tiempo',
    expectedEntry: '08:00',
    expectedExit: '14:00',
    departureTime: '14:00',
    departureType: 'Normal',
    justificationReason: null,
    departureReason: null,
    registeredBy: 1,
    ...extra,
  };
}

function taller(extra: Partial<PersonalTallerRecord> = {}): PersonalTallerRecord {
  return { id: 1, personalId: 1, date: MONDAY, arrivalTime: '16:00', departureTime: '18:30', ...extra };
}

const run = (records: PersonalArrivalRecord[], talleres: PersonalTallerRecord[] = [], today = TODAY) =>
  computeOvertime([base], records, talleres, today)[0];

describe('computeOvertime', () => {
  it('cuenta los minutos exactos después de su hora de salida', () => {
    const s = run([rec({ departureTime: '15:07' })]);
    expect(s.afterExitMin).toBe(67);
    expect(s.totalMin).toBe(67);
    expect(s.items[0].kind).toBe('salida tarde');
  });

  it('llegar antes de su entrada no cuenta como extra', () => {
    expect(run([rec({ arrivalTime: '07:30' })]).totalMin).toBe(0);
  });

  it('salir a su hora o antes no suma ni resta', () => {
    expect(run([rec()]).totalMin).toBe(0);
    expect(run([rec({ departureTime: '12:00', departureType: 'Anticipada' })]).totalMin).toBe(0);
  });

  it('suma salida tarde y taller del mismo día', () => {
    const s = run([rec({ departureTime: '15:00' })], [taller()]);
    expect(s.afterExitMin).toBe(60);
    expect(s.tallerMin).toBe(150);
    expect(s.totalMin).toBe(210);
  });

  it('suma varios talleres del mismo día', () => {
    const s = run([rec()], [taller({ arrivalTime: '15:00', departureTime: '16:00' }), taller({ id: 2 })]);
    expect(s.tallerMin).toBe(210);
  });

  it('no asistió en la mañana: el taller de la tarde cuenta completo', () => {
    const falta = rec({ arrivalTime: null, status: 'Falta', departureTime: null, departureType: null });
    expect(run([falta], [taller()]).tallerMin).toBe(150);
    expect(run([], [taller()]).tallerMin).toBe(150);
  });

  it('del taller solo cuenta lo que está fuera de su horario', () => {
    const s = run([rec({ departureTime: '12:00', departureType: 'Anticipada' })], [taller({ arrivalTime: '13:00', departureTime: '15:00' })]);
    expect(s.tallerMin).toBe(60);
  });

  it('un día que no le toca cuenta completo, por clase o por taller', () => {
    const s = run([
      rec({ date: SATURDAY, status: 'Fuera de horario', expectedEntry: null, expectedExit: null, arrivalTime: '09:00', departureTime: '11:30' }),
    ]);
    expect(s.offDayMin).toBe(150);
    expect(run([], [taller({ date: SATURDAY, arrivalTime: '09:00', departureTime: '10:00' })]).tallerMin).toBe(60);
  });

  it('sin salida marcada cuenta 0 y queda por revisar, salvo que sea hoy', () => {
    const open = taller({ departureTime: null });
    expect(run([], [open]).totalMin).toBe(0);
    expect(run([], [open]).missingDepartureDays).toBe(1);
    expect(run([], [open], MONDAY).missingDepartureDays).toBe(0);
  });

  it('avisa si el horario no tiene hora de salida', () => {
    const noExit: Personal = { ...base, schedule: [{ day: 1, entry: '08:00', exit: null }] };
    const [s] = computeOvertime([noExit], [rec({ expectedExit: null, departureTime: '15:00' })], [], TODAY);
    expect(s.totalMin).toBe(0);
    expect(s.daysWithoutExit).toBe(1);
  });

  it('no mezcla registros de otro empleado', () => {
    expect(run([rec({ personalId: 2, departureTime: '15:00' })], [taller({ personalId: 2 })]).totalMin).toBe(0);
  });
});
