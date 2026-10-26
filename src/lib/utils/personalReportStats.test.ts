import { describe, expect, it } from 'vitest';
import { countBy, summarizePersonalAttendance, totalsOf } from './personalReportStats';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

const base: Personal = {
  id: 1,
  barcode: '12345678',
  fullName: 'PRUEBA, Ana',
  category: 'Administrativo',
  position: null,
  birthDate: null,
  address: null,
  phone: null,
  email: null,
  profilePhoto: null,
  active: true,
  createdAt: '2026-10-01',
  // Lunes a viernes 07:30
  schedule: [1, 2, 3, 4, 5].map((d) => ({ day: d as 1, entry: '07:30', exit: '13:00' })),
};

function rec(date: string, status: PersonalArrivalRecord['status'], extra: Partial<PersonalArrivalRecord> = {}) {
  return {
    id: Math.random(),
    personalId: 1,
    date,
    arrivalTime: '07:30',
    status,
    expectedEntry: '07:30',
    expectedExit: '13:00',
    departureTime: null,
    departureType: null,
    justificationReason: null,
    departureReason: null,
    registeredBy: 1,
    ...extra,
  } satisfies PersonalArrivalRecord;
}

describe('summarizePersonalAttendance', () => {
  it('cuenta estados, días programados y días sin registro', () => {
    // Semana 19–23 oct 2026 (lun–vie); "hoy" = sáb 24
    const records = [
      rec('2026-10-19', 'A tiempo'),
      rec('2026-10-20', 'Tarde', { departureType: 'Anticipada' }),
      rec('2026-10-21', 'Falta justificada', { arrivalTime: null }),
      rec('2026-10-24', 'Fuera de horario'),
    ];
    const [s] = summarizePersonalAttendance([base], records, '2026-10-19', '2026-10-25', '2026-10-24');
    expect(s.scheduledDays).toBe(5);
    expect(s.onTime).toBe(1);
    expect(s.late).toBe(1);
    expect(s.absentJustified).toBe(1);
    expect(s.offSchedule).toBe(1);
    expect(s.noRecord).toBe(2); // jue 22 y vie 23
    expect(s.earlyDepartures).toBe(1);
    expect(s.punctuality).toBe(50);
    expect(totalsOf([s]).absent).toBe(2);
  });

  it('no cuenta días anteriores a su registro', () => {
    const [s] = summarizePersonalAttendance(
      [{ ...base, createdAt: '2026-10-22' }],
      [],
      '2026-10-19',
      '2026-10-23',
      '2026-10-24',
    );
    expect(s.scheduledDays).toBe(2);
    expect(s.noRecord).toBe(2);
  });
});

describe('countBy', () => {
  it('ordena de mayor a menor', () => {
    expect(countBy(['a', 'b', 'a'], (x) => x)).toEqual([
      { label: 'a', count: 2 },
      { label: 'b', count: 1 },
    ]);
  });
});
