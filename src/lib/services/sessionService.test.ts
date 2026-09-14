import { describe, expect, it } from 'vitest';
import { sessionService } from './sessionService';

describe('sessionService', () => {
  it('usa 12 h de inactividad para tutor, docente y admin; 15 min para padre', () => {
    expect(sessionService.getIdleDurationMs('Tutor')).toBe(12 * 60 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Docente')).toBe(12 * 60 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Padre')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Supervisor')).toBe(12 * 60 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Admin')).toBe(12 * 60 * 60 * 1000);
  });
});
