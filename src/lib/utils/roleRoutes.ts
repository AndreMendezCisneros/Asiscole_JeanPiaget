import type { UserRole } from '@/types';

const STAFF_ROLES: UserRole[] = ['Supervisor', 'Director', 'Admin', 'Cajero'];

export function getHomeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'Tutor':
      return '/tutor-scanner';
    case 'Docente':
      return '/docente-scanner';
    case 'Padre':
      return '/parent-portal';
    case 'Cajero':
      return '/pensiones';
    default:
      return '/dashboard';
  }
}

export function isStaffRole(role?: UserRole | null): role is UserRole {
  return Boolean(role && STAFF_ROLES.includes(role));
}

export function canAccessStaffRoute(role: UserRole | undefined, requiredRole?: string[]): boolean {
  if (!role) return false;
  if (!requiredRole?.length) return isStaffRole(role);
  return requiredRole.includes(role);
}
