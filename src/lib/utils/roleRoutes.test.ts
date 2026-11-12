import { describe, expect, it } from 'vitest';
import { canAccessStaffRoute, getHomeRouteForRole, isStaffRole } from './roleRoutes';
import { getStaffNavItems } from '@/config/staffNavigation';

describe('roleRoutes Cajero', () => {
  it('trata a Cajero como staff y lo manda a pensiones', () => {
    expect(isStaffRole('Cajero')).toBe(true);
    expect(getHomeRouteForRole('Cajero')).toBe('/pensiones');
  });

  it('deja entrar a pensiones y system-config, no a incidencias ni auditoría', () => {
    expect(canAccessStaffRoute('Cajero', ['Director', 'Admin', 'Cajero'])).toBe(true);
    expect(canAccessStaffRoute('Cajero', ['Admin', 'Cajero'])).toBe(true);
    expect(canAccessStaffRoute('Cajero', ['Supervisor', 'Director', 'Admin'])).toBe(false);
    expect(canAccessStaffRoute('Cajero', ['Admin'])).toBe(false);
  });
});

describe('staffNavigation Cajero', () => {
  it('muestra Asistencia del personal, Pensiones y Administración sin Auditoría', () => {
    const items = getStaffNavItems('Cajero');
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(['Asistencia del personal', 'Pensiones', 'Administración']);
    const admin = items.find((i) => i.label === 'Administración');
    expect(admin?.subItems?.map((s) => s.label)).toEqual(['Configuración']);
  });

  it('Admin conserva Auditoría y Configuración', () => {
    const items = getStaffNavItems('Admin');
    const admin = items.find((i) => i.label === 'Administración');
    expect(admin?.subItems?.map((s) => s.label)).toEqual(['Auditoría', 'Configuración']);
  });
});

describe('rol RR.HH.', () => {
  it('es staff, entra a /personal y no a estudiantes', () => {
    expect(isStaffRole('RRHH')).toBe(true);
    expect(getHomeRouteForRole('RRHH')).toBe('/personal');
    expect(canAccessStaffRoute('RRHH', ['RRHH'])).toBe(true);
    expect(canAccessStaffRoute('RRHH', ['Supervisor', 'Director', 'Admin'])).toBe(false);
    expect(canAccessStaffRoute('Admin', ['RRHH'])).toBe(false);
  });

  it('solo RR.HH. ve el menú Personal', () => {
    expect(getStaffNavItems('RRHH').map((i) => i.label)).toEqual(['Personal']);
    expect(getStaffNavItems('Admin').some((i) => i.label === 'Personal')).toBe(false);
    const subs = getStaffNavItems('RRHH')[0].subItems?.map((s) => s.path) ?? [];
    expect(subs).toContain('/personal/horas');
    expect(subs).toContain('/personal/promotoria');
    expect(subs).toContain('/personal/horas-extra');
  });

  it('Admin solo registra incidencias del personal', () => {
    const adminSubs = getStaffNavItems('Admin').flatMap((i) => i.subItems?.map((s) => s.path) ?? []);
    expect(adminSubs.filter((p) => p.startsWith('/personal'))).toEqual(['/personal/registrar-incidencia']);
    const directorSubs = getStaffNavItems('Director').flatMap((i) => i.subItems?.map((s) => s.path) ?? []);
    expect(directorSubs).not.toContain('/personal/registrar-incidencia');
  });
});

describe('rol DocenteTutor', () => {
  it('no es staff y entra solo a /aula', () => {
    expect(isStaffRole('DocenteTutor')).toBe(false);
    expect(getHomeRouteForRole('DocenteTutor')).toBe('/aula');
    expect(canAccessStaffRoute('DocenteTutor', ['DocenteTutor'])).toBe(true);
    expect(canAccessStaffRoute('DocenteTutor', ['Supervisor', 'Director', 'Admin'])).toBe(false);
    expect(canAccessStaffRoute('DocenteTutor', ['RRHH'])).toBe(false);
    expect(canAccessStaffRoute('DocenteTutor', ['Tutor'])).toBe(false);
    expect(canAccessStaffRoute('DocenteTutor')).toBe(false);
  });

  it('no ve menú del staff', () => {
    expect(getStaffNavItems('DocenteTutor')).toEqual([]);
  });
});
