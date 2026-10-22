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
