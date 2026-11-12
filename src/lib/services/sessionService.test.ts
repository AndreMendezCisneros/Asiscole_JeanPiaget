import { describe, expect, it } from 'vitest';
import { sessionService } from './sessionService';

describe('sessionService', () => {
  it('usa 5 h de inactividad para tutor/docente, 15 min padre y 30 min resto', () => {
    expect(sessionService.getIdleDurationMs('Tutor')).toBe(5 * 60 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Docente')).toBe(5 * 60 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Padre')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Supervisor')).toBe(30 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Admin')).toBe(30 * 60 * 1000);
  });
});
