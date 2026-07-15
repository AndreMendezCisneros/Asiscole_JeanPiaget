import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  FileText,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  Clock,
  CalendarDays,
} from 'lucide-react';

export interface StaffNavSubItem {
  path: string;
  label: string;
}

export interface StaffNavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  subItems?: StaffNavSubItem[];
}

const ALL_STAFF_NAV_ITEMS: StaffNavItem[] = [
  {
    path: '/',
    label: 'Inicio',
    icon: LayoutDashboard,
    roles: ['Supervisor', 'Director', 'Admin'],
  },
  {
    path: '/arrival-control',
    label: 'Asistencia',
    icon: Clock,
    roles: ['Supervisor', 'Director', 'Admin'],
    subItems: [
      { path: '/arrival-control', label: 'Control de Llegadas' },
      { path: '/departure-control', label: 'Registro de Salidas' },
    ],
  },
  {
    path: '/incidents',
    label: 'Incidencias',
    icon: FileText,
    roles: ['Supervisor', 'Director', 'Admin'],
    subItems: [
      { path: '/incidents', label: 'Lista de Incidencias' },
      { path: '/register', label: 'Registrar Incidencia' },
      { path: '/justify-faults', label: 'Justificar Faltas' },
    ],
  },
  {
    path: '/students',
    label: 'Estudiantes',
    icon: Users,
    roles: ['Supervisor', 'Director', 'Admin'],
  },
  {
    path: '/parent-meetings',
    label: 'Citas con Padres',
    icon: CalendarDays,
    roles: ['Supervisor', 'Director', 'Admin'],
  },
  {
    path: '/faults',
    label: 'Catálogos',
    icon: BookOpen,
    roles: ['Director', 'Admin'],
    subItems: [{ path: '/faults', label: 'Catálogo de Faltas' }],
  },
  {
    path: '/reports',
    label: 'Reportes',
    icon: BarChart3,
    roles: ['Supervisor', 'Director', 'Admin'],
    subItems: [
      { path: '/reports', label: 'Reportes de Incidencias' },
      { path: '/attendance-report', label: 'Reporte de Asistencias' },
    ],
  },
  {
    path: '/system-config',
    label: 'Administración',
    icon: Settings,
    roles: ['Admin'],
    subItems: [
      { path: '/admin/teachers', label: 'Docentes' },
      { path: '/audit', label: 'Auditoría' },
      { path: '/system-config', label: 'Configuración' },
    ],
  },
];

export function getStaffNavItems(role?: string | null): StaffNavItem[] {
  if (!role || role === 'Tutor' || role === 'Docente' || role === 'Padre') return [];
  return ALL_STAFF_NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function findStaffNavGroup(
  pathname: string,
  items: StaffNavItem[]
): StaffNavItem | undefined {
  return items.find((item) => {
    if (pathname === item.path) return Boolean(item.subItems?.length);
    return item.subItems?.some((sub) => pathname === sub.path) ?? false;
  });
}

export function isStaffNavItemActive(pathname: string, item: StaffNavItem): boolean {
  if (pathname === item.path) return true;
  return item.subItems?.some((sub) => pathname === sub.path) ?? false;
}

/** Ruta al hacer clic en un ítem con submenú (prioriza la ruta principal del grupo). */
export function getStaffNavDefaultPath(item: StaffNavItem): string {
  if (!item.subItems?.length) return item.path;
  const mainInSubs = item.subItems.find((sub) => sub.path === item.path);
  return mainInSubs?.path ?? item.subItems[0].path;
}
