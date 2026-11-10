import { describe, expect, it, vi } from 'vitest';
import { sessionService } from './sessionService';

describe('sessionService', () => {
  it('usa 45 min de inactividad para tutor y docente, 15 para padre y 30 para el resto', () => {
    expect(sessionService.getIdleDurationMs('Tutor')).toBe(45 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Docente')).toBe(45 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Padre')).toBe(15 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Supervisor')).toBe(30 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Admin')).toBe(30 * 60 * 1000);
    expect(sessionService.getIdleDurationMs('Cajero')).toBe(30 * 60 * 1000);
  });
});

describe('sessionService.touchActivity', () => {
  it('no alarga la expiración local (solo el servidor la fija)', () => {
    const memoryStorage = () => {
      const mem = new Map<string, string>();
      return {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
      };
    };
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('localStorage', memoryStorage());
    const user = { id: 1, username: 'x', fullName: 'X', email: null, role: 'RRHH', active: true } as never;
    sessionService.saveSession(user, 'a'.repeat(64), 60_000);
    const before = sessionService.readSessionRaw()!.expiresAt;
    sessionService.touchActivity();
    expect(sessionService.readSessionRaw()!.expiresAt).toBe(before);
    sessionService.syncServerExpiry(30 * 60_000);
    expect(sessionService.readSessionRaw()!.expiresAt).toBeGreaterThan(before);
    sessionService.clearSession();
    vi.unstubAllGlobals();
  });
});
