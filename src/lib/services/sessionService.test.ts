import { describe, expect, it } from 'vitest';
import { sessionService } from './sessionService';

describe('sessionService', () => {
  it('usa 15 min de inactividad para tutor, docente y padre; 30 para el resto', () => {
    expect(sessionService.getIdleDurationMs('Tutor')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Docente')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Padre')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Supervisor')).toBe(30 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Admin')).toBe(30 * 60 * 1000);
  });
});
