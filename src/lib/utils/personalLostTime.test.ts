import { describe, expect, it } from 'vitest';
import { compliancePct, computeLostTime, formatMinutes, lostFor } from './personalLostTime';
import { buildPersonalDayRows, resolveDepartureStatus } from './personalAttendanceRows';
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
  // Lunes a viernes 07:30–15:30 (8 h)
  schedule: [1, 2, 3, 4, 5].map((d) => ({ day: d as 1, entry: '07:30', exit: '15:30' })),
};

function rec(date: string, status: PersonalArrivalRecord['status'], extra: Partial<PersonalArrivalRecord> = {}): PersonalArrivalRecord {
  return {
    id: Math.random(),
    personalId: 1,
    date,
    arrivalTime: '07:30',
    status,
    expectedEntry: '07:30',
    expectedExit: '15:30',
    departureTime: '15:30',
    departureType: 'Normal',
    justificationReason: null,
    departureReason: null,
    registeredBy: 1,
    ...extra,
  };
}

describe('computeLostTime', () => {
  // Semana lun 19 – vie 23 oct 2026; hoy sáb 24
  const records = [
    rec('2026-10-19', 'A tiempo'),
    rec('2026-10-20', 'Tarde', { arrivalTime: '08:00' }), // 30 min
    rec('2026-10-21', 'Falta'), // 8 h
    rec('2026-10-22', 'Tarde justificada', { arrivalTime: '07:45' }), // 15 min justificados
    rec('2026-10-23', 'A tiempo', { departureTime: '14:30', departureType: 'Autorizada' }), // 1 h autorizada
  ];
  const [s] = computeLostTime([base], records, '2026-10-19', '2026-10-25', '2026-10-24', '10:00');

  it('suma tardanza, inasistencia (jornada completa) y salida anticipada', () => {
    expect(s.scheduledMin).toBe(5 * 480);
    expect(s.lateMin).toBe(45);
    expect(s.absenceMin).toBe(480);
    expect(s.earlyMin).toBe(60);
    expect(s.lostTotalMin).toBe(585);
  });

  it('vista total vs descontando justificadas', () => {
    expect(s.lostJustifiedMin).toBe(75);
    expect(lostFor(s, 'total')).toBe(585);
    expect(lostFor(s, 'neto')).toBe(510);
    expect(formatMinutes(lostFor(s, 'neto'))).toBe('8 h 30 min');
    expect(compliancePct(s, 'neto')).toBe(79);
  });

  it('día sin marcar ya pasado cuenta como inasistencia; sin salida no descuenta', () => {
    const [t] = computeLostTime(
      [base],
      [rec('2026-10-19', 'A tiempo', { departureTime: null, departureType: null })],
      '2026-10-19',
      '2026-10-20',
      '2026-10-24',
      '10:00',
    );
    expect(t.absenceDays).toBe(1); // martes sin registro
    expect(t.noDepartureDays).toBe(1);
    expect(t.lostTotalMin).toBe(480);
  });

  it('sin hora de salida no puede calcular la jornada', () => {
    const sinSalida = { ...base, schedule: [{ day: 1 as const, entry: '07:30', exit: null }] };
    const [t] = computeLostTime([sinSalida], [], '2026-10-19', '2026-10-19', '2026-10-24', '10:00');
    expect(t.daysWithoutExit).toBe(1);
    expect(t.items[0].minutes).toBeNull();
  });
});

describe('estado del día con margen de inasistencia', () => {
  const today = '2026-10-26'; // lunes
  it('aún sin marcar dentro del margen, inasistencia al pasar 120 min', () => {
    expect(buildPersonalDayRows([base], [], today, today, '07:20')[0].status).toBe('Pendiente');
    expect(buildPersonalDayRows([base], [], today, today, '09:00')[0].status).toBe('Sin llegada');
    expect(buildPersonalDayRows([base], [], today, today, '09:30')[0].status).toBe('Falta');
    expect(buildPersonalDayRows([base], [], today, today, '08:30', 60)[0].status).toBe('Falta');
  });

  it('no marcó salida pasada su hora', () => {
    const r = rec(today, 'A tiempo', { departureTime: null, departureType: null });
    expect(resolveDepartureStatus(r, '15:30', today, '15:00')).toBe('Pendiente');
    expect(resolveDepartureStatus(r, '15:30', today, '15:31')).toBe('No marcó salida');
    expect(resolveDepartureStatus({ ...r, date: '2026-10-23' }, '15:30', today, '08:00')).toBe('No marcó salida');
  });
});

describe('formatMinutes', () => {
  it('formatea horas y minutos', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(480)).toBe('8 h');
    expect(formatMinutes(null)).toBe('—');
  });
});
