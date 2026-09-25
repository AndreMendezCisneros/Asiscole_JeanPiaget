import { describe, expect, it } from 'vitest';
import {
  DEBT_CARNET_THRESHOLD,
  DEBT_FALTA_THRESHOLD,
  DEBT_TARDE_THRESHOLD,
  countEventsAfterBaseline,
  isCarnetFaultName,
  isEventAfterBaseline,
  isFaltaInasistenciaName,
  normalizeFaultName,
  shouldAlertDebtAfterIncident,
  shouldAlertDebtFromCounts,
} from './debtAlarm';

describe('normalizeFaultName', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizeFaultName('No porta carné institucional')).toBe(
      'no porta carne institucional',
    );
    expect(normalizeFaultName('No porta carnet institucional')).toBe(
      'no porta carnet institucional',
    );
    expect(normalizeFaultName('  Falta  ')).toBe('falta');
  });
});

describe('isFaltaInasistenciaName', () => {
  it('acepta "Falta" y "Falta académica"', () => {
    expect(isFaltaInasistenciaName('Falta')).toBe(true);
    expect(isFaltaInasistenciaName('falta')).toBe(true);
    expect(isFaltaInasistenciaName('FALTA')).toBe(true);
    expect(isFaltaInasistenciaName('Falta académica')).toBe(true);
    expect(isFaltaInasistenciaName('FALTA ACADEMICA')).toBe(true);
    expect(isFaltaInasistenciaName('Falta de respeto')).toBe(false);
  });
});

describe('isCarnetFaultName', () => {
  it('detecta carné institucional (con/sin acento)', () => {
    expect(isCarnetFaultName('No porta carné institucional')).toBe(true);
    expect(isCarnetFaultName('No porta carnet institucional')).toBe(true);
    expect(isCarnetFaultName('NO PORTA CARNET INSTITUCIONAL')).toBe(true);
    expect(isCarnetFaultName('No porta el polo institucional')).toBe(false);
  });
});

describe('shouldAlertDebtFromCounts', () => {
  it('alerta en umbrales ≥ 4 faltas/carnet y ≥ 5 tardes', () => {
    expect(
      shouldAlertDebtFromCounts({ faltaCount: 3, carnetCount: 3, tardeCount: 4 }),
    ).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: false,
      alertPago: false,
    });
    expect(
      shouldAlertDebtFromCounts({
        faltaCount: DEBT_FALTA_THRESHOLD,
        carnetCount: DEBT_CARNET_THRESHOLD,
        tardeCount: DEBT_TARDE_THRESHOLD,
      }),
    ).toEqual({
      alertFalta: true,
      alertCarnet: true,
      alertTarde: true,
      alertPago: false,
    });
    expect(shouldAlertDebtFromCounts({ faltaCount: 5, carnetCount: 0, tardeCount: 0 })).toEqual({
      alertFalta: true,
      alertCarnet: false,
      alertTarde: false,
      alertPago: false,
    });
    expect(shouldAlertDebtFromCounts({ faltaCount: 0, carnetCount: 0, tardeCount: 5 })).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: true,
      alertPago: false,
    });
    expect(
      shouldAlertDebtFromCounts({
        faltaCount: 0,
        carnetCount: 0,
        tardeCount: 0,
        alertPago: true,
      }),
    ).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: false,
      alertPago: true,
    });
  });
});

describe('isEventAfterBaseline / countEventsAfterBaseline', () => {
  it('sin baseline cuenta todos; con baseline solo posteriores', () => {
    expect(isEventAfterBaseline('2026-09-10', null)).toBe(true);
    expect(isEventAfterBaseline('2026-09-10', '2026-09-14T12:00:00.000Z')).toBe(false);
    expect(isEventAfterBaseline('2026-09-15', '2026-09-14T12:00:00.000Z')).toBe(true);

    const days = [{ fecha: '2026-09-10' }, { fecha: '2026-09-15' }, { fecha: '2026-09-16' }];
    expect(countEventsAfterBaseline(days, null, (d) => d.fecha)).toBe(3);
    expect(
      countEventsAfterBaseline(days, '2026-09-14T12:00:00.000Z', (d) => d.fecha),
    ).toBe(2);
  });

  it('tras reset de tardanzas, hace falta volver a juntar 5', () => {
    const baseline = '2026-09-14T18:00:00.000Z';
    const tardes = [
      { fecha: '2026-09-12' },
      { fecha: '2026-09-13' },
      { fecha: '2026-09-14' },
      { fecha: '2026-09-15' },
      { fecha: '2026-09-16' },
      { fecha: '2026-09-17' },
      { fecha: '2026-09-18' },
    ];
    const after = countEventsAfterBaseline(tardes, baseline, (d) => d.fecha);
    expect(after).toBe(4);
    expect(
      shouldAlertDebtFromCounts({ faltaCount: 0, carnetCount: 0, tardeCount: after }),
    ).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: false,
      alertPago: false,
    });
    const withFifth = countEventsAfterBaseline(
      [...tardes, { fecha: '2026-09-19' }],
      baseline,
      (d) => d.fecha,
    );
    expect(withFifth).toBe(5);
    expect(
      shouldAlertDebtFromCounts({ faltaCount: 0, carnetCount: 0, tardeCount: withFifth }),
    ).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: true,
      alertPago: false,
    });
  });
});

describe('shouldAlertDebtAfterIncident', () => {
  it('solo al cruzar el umbral con la incidencia nueva', () => {
    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'No porta carné institucional',
        faltaCount: 0,
        carnetCount: 4,
      }),
    ).toEqual({ alertFalta: false, alertCarnet: true, alertTarde: false, alertPago: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'No porta carné institucional',
        faltaCount: 0,
        carnetCount: 5,
      }),
    ).toEqual({ alertFalta: false, alertCarnet: false, alertTarde: false, alertPago: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'Falta',
        faltaCount: 4,
        carnetCount: 0,
      }),
    ).toEqual({ alertFalta: true, alertCarnet: false, alertTarde: false, alertPago: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'Tardanza reiterada',
        faltaCount: 10,
        carnetCount: 10,
      }),
    ).toEqual({ alertFalta: false, alertCarnet: false, alertTarde: false, alertPago: false });
  });
});
