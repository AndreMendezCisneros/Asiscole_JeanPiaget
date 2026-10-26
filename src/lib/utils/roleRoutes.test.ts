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
  it('solo muestra Pensiones y Administración sin Auditoría', () => {
    const items = getStaffNavItems('Cajero');
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(['Pensiones', 'Administración']);
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
  });
});
