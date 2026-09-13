import { describe, expect, it } from 'vitest';
import {
  DEBT_CARNET_THRESHOLD,
  DEBT_FALTA_THRESHOLD,
  DEBT_TARDE_THRESHOLD,
  isCarnetFaultName,
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
  it('alerta en umbrales ≥ 4 faltas/carnet y ≥ 3 tardes', () => {
    expect(
      shouldAlertDebtFromCounts({ faltaCount: 3, carnetCount: 3, tardeCount: 2 }),
    ).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: false,
    });
    expect(
      shouldAlertDebtFromCounts({
        faltaCount: DEBT_FALTA_THRESHOLD,
        carnetCount: DEBT_CARNET_THRESHOLD,
        tardeCount: DEBT_TARDE_THRESHOLD,
      }),
    ).toEqual({ alertFalta: true, alertCarnet: true, alertTarde: true });
    expect(shouldAlertDebtFromCounts({ faltaCount: 5, carnetCount: 0, tardeCount: 0 })).toEqual({
      alertFalta: true,
      alertCarnet: false,
      alertTarde: false,
    });
    expect(shouldAlertDebtFromCounts({ faltaCount: 0, carnetCount: 0, tardeCount: 3 })).toEqual({
      alertFalta: false,
      alertCarnet: false,
      alertTarde: true,
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
    ).toEqual({ alertFalta: false, alertCarnet: true, alertTarde: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'No porta carné institucional',
        faltaCount: 0,
        carnetCount: 5,
      }),
    ).toEqual({ alertFalta: false, alertCarnet: false, alertTarde: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'Falta',
        faltaCount: 4,
        carnetCount: 0,
      }),
    ).toEqual({ alertFalta: true, alertCarnet: false, alertTarde: false });

    expect(
      shouldAlertDebtAfterIncident({
        faultName: 'Tardanza reiterada',
        faltaCount: 10,
        carnetCount: 10,
      }),
    ).toEqual({ alertFalta: false, alertCarnet: false, alertTarde: false });
  });
});
