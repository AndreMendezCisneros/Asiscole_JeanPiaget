import { describe, expect, it } from 'vitest';
import {
  computeWorkedTime,
  monthEndOf,
  monthLabel,
  monthRangeWithin,
  monthsBetween,
  unauthorizedDepartures,
} from './personalWorkedTime';
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
  // Lunes a viernes 07:00–14:00
  schedule: [1, 2, 3, 4, 5].map((d) => ({ day: d as 1, entry: '07:00', exit: '14:00' })),
};

const MONDAY = '2026-11-02';
const TODAY = '2026-11-20';

function rec(extra: Partial<PersonalArrivalRecord> = {}): PersonalArrivalRecord {
  return {
    id: 1,
    personalId: 1,
    date: MONDAY,
    arrivalTime: '07:00',
    status: 'A tiempo',
    expectedEntry: '07:00',
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
  return { id: 1, personalId: 1, date: MONDAY, arrivalTime: '16:00', departureTime: '18:00', ...extra };
}

describe('horas extra (ejemplo del usuario)', () => {
  it('entra 7:00, su salida es 14:00 y se va 15:00 → 1 h extra', () => {
    const s = computeOvertime([base], [rec({ departureTime: '15:00' })], [], TODAY)[0];
    expect(s.afterExitMin).toBe(60);
    expect(s.totalMin).toBe(60);
  });
});

describe('computeWorkedTime', () => {
  it('suma salida − llegada reales', () => {
    const s = computeWorkedTime(1, [rec({ arrivalTime: '07:10', departureTime: '15:00' })], [], TODAY);
    expect(s.workedMin).toBe(470);
    expect(s.classMin).toBe(470);
    expect(s.daysWorked).toBe(1);
  });

  it('suma el taller fuera de la jornada y no cuenta dos veces lo que se cruza', () => {
    const s = computeWorkedTime(1, [rec()], [taller(), taller({ id: 2, arrivalTime: '13:00', departureTime: '15:00' })], TODAY);
    // jornada 07–14 (420) + 14–15 (60) + 16–18 (120)
    expect(s.workedMin).toBe(600);
    expect(s.tallerMin).toBe(180);
  });

  it('día sin salida marcada cuenta 0 y se reporta', () => {
    const s = computeWorkedTime(1, [rec({ departureTime: null, departureType: null })], [], TODAY);
    expect(s.workedMin).toBe(0);
    expect(s.noDepartureDays).toBe(1);
  });

  it('hoy sin salida todavía no se reporta como pendiente', () => {
    const s = computeWorkedTime(1, [rec({ date: TODAY, departureTime: null })], [], TODAY);
    expect(s.noDepartureDays).toBe(0);
  });

  it('ignora a otros empleados', () => {
    expect(computeWorkedTime(1, [rec({ personalId: 2 })], [], TODAY).workedMin).toBe(0);
  });
});

describe('unauthorizedDepartures', () => {
  it('solo trae las anticipadas sin autorización, con minutos antes', () => {
    const list = unauthorizedDepartures(base, [
      rec({ departureTime: '12:30', departureType: 'Anticipada' }),
      rec({ id: 2, date: '2026-11-03', departureTime: '12:00', departureType: 'Autorizada' }),
      rec({ id: 3, date: '2026-11-04' }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].minutesEarly).toBe(90);
  });
});

describe('meses', () => {
  it('lista y recorta meses', () => {
    expect(monthsBetween('2026-01-15', '2026-03-02')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(monthsBetween('2025-12-01', '2026-01-01')).toEqual(['2025-12', '2026-01']);
    expect(monthEndOf('2028-02')).toBe('2028-02-29');
    expect(monthRangeWithin('2026-03', '2026-03-10', '2026-12-31')).toEqual({ from: '2026-03-10', to: '2026-03-31' });
    expect(monthLabel('2026-11')).toBe('Noviembre 2026');
  });
});
