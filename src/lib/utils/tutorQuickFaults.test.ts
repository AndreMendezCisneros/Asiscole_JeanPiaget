import { describe, expect, it } from 'vitest';
import { pickTutorQuickFaults, TUTOR_QUICK_FAULT_NAMES } from './tutorQuickFaults';

describe('pickTutorQuickFaults', () => {
  it('devuelve las 6 principales en el orden pedido', () => {
    const catalog = [
      { id: 9, name: 'Uso de prendas no autorizadas', active: true },
      { id: 1, name: 'Llegó tarde a clase', active: true },
      { id: 4, name: 'Asistió con buzo', active: true },
      { id: 2, name: 'No porta carnet institucional', active: true },
      { id: 6, name: 'Uñas fuera de la normativa', active: true },
      { id: 3, name: 'Presentación personal inadecuada', active: true },
      { id: 5, name: 'Cabello largo', active: true },
    ];

    expect(pickTutorQuickFaults(catalog).map((f) => f.name)).toEqual([...TUTOR_QUICK_FAULT_NAMES]);
  });

  it('ignora inactivas y no rellena con otras faltas', () => {
    const catalog = [
      { name: 'No porta carnet institucional', active: false },
      { name: 'Presentación personal inadecuada', active: true },
      { name: 'Llegó tarde a clase', active: true },
    ];

    expect(pickTutorQuickFaults(catalog).map((f) => f.name)).toEqual([
      'Presentación personal inadecuada',
    ]);
  });

  it('acepta acentos o mayúsculas distintas', () => {
    const catalog = [
      { name: 'ASISTIO CON BUZO', active: true },
      { name: 'Unas fuera de la normativa', active: true },
    ];

    expect(pickTutorQuickFaults(catalog).map((f) => f.name)).toEqual([
      'ASISTIO CON BUZO',
      'Unas fuera de la normativa',
    ]);
  });
});
