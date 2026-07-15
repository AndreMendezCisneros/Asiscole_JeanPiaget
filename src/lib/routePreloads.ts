/**
 * Precarga de chunks por ruta — evita Suspense colgado en la primera visita.
 */

const preloaded = new Set<string>();

type PreloadFn = () => Promise<unknown>;

const STAFF_ROUTE_IMPORTS: Record<string, PreloadFn> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/register': () => import('@/pages/RegisterIncident'),
  '/incidents': () => import('@/pages/IncidentsList'),
  '/students': () => import('@/pages/StudentsList'),
  '/attendance-report': () => import('@/pages/AttendanceReport'),
  '/arrival-control': () => import('@/pages/ArrivalControl'),
  '/departure-control': () => import('@/pages/DepartureControl'),
  '/parent-meetings': () => import('@/pages/ParentMeetings'),
  '/justify-faults': () => import('@/pages/JustifyFaults'),
  '/admin/teachers': () => import('@/pages/TeachersAdmin'),
  '/faults': () => import('@/pages/FaultsCatalog'),
  '/reports': () => import('@/pages/Reports'),
  '/audit': () => import('@/pages/AuditLogs'),
  '/system-config': () => import('@/pages/SystemConfig'),
};

const STAFF_PRELOAD_PRIORITY = [
  '/dashboard',
  '/arrival-control',
  '/departure-control',
  '/incidents',
  '/register',
  '/students',
  '/reports',
  '/attendance-report',
];

/** Precarga el chunk de una ruta (idempotente). */
export function preloadRoute(path: string): void {
  const normalized = path.split('?')[0];
  const importFn = STAFF_ROUTE_IMPORTS[normalized];
  if (!importFn || preloaded.has(normalized)) return;

  preloaded.add(normalized);
  void importFn().catch(() => {
    preloaded.delete(normalized);
  });
}

/** Precarga rutas staff comunes en segundo plano tras entrar al panel. */
export function preloadStaffRoutes(): void {
  if (typeof window === 'undefined') return;

  const run = async () => {
    for (const path of STAFF_PRELOAD_PRIORITY) {
      preloadRoute(path);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => void run(), { timeout: 5000 });
  } else {
    window.setTimeout(() => void run(), 2000);
  }
}
