import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, ClipboardList, DoorOpen, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuardyMark } from '@/components/brand/GuardyMark';
import { PageLoader } from '@/components/ui/page-loader';
import { authService } from '@/lib/services';
import { tutorAulaService } from '@/lib/services/tutorAulaService';
import { formatSalon, type TutorSalon } from '@/types/tutorAula';
import { cn } from '@/lib/utils';

export interface TutorAulaContext {
  salon: TutorSalon;
  studentCount: number;
}

const TABS = [
  { to: '/aula', label: 'Llegada', icon: LogIn, end: true },
  { to: '/aula/salida', label: 'Salida', icon: DoorOpen, end: false },
  { to: '/aula/incidencias', label: 'Incidencias', icon: ClipboardList, end: false },
  { to: '/aula/asistencia', label: 'Asistencia', icon: BarChart3, end: false },
] as const;

/** Docente tutor: solo lectura de su salón, sin el menú del staff. */
export function TutorAulaLayout() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tutor-aula', 'salon', user?.id],
    queryFn: async () => {
      const res = await tutorAulaService.getMySalon();
      if (res.error || !res.salon) throw new Error(res.error ?? 'Sin salón asignado');
      return { salon: res.salon, studentCount: res.students };
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const logout = async () => {
    await authService.logout();
    navigate('/login', { replace: true });
  };

  const context: TutorAulaContext | null = data ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <GuardyMark size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{context ? formatSalon(context.salon) : 'Mi salón'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.fullName} · Docente tutor
              {context ? ` · ${context.studentCount} alumnos` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void logout()} aria-label="Cerrar sesión">
            <LogOut className="h-4 w-4 sm:mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
        <nav aria-label="Secciones del salón" className="mx-auto max-w-5xl overflow-x-auto px-2">
          <ul className="flex min-w-max gap-1">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        {isLoading ? (
          <PageLoader message="Cargando su salón..." />
        ) : !context ? (
          <div role="alert" className="mx-auto mt-10 max-w-md rounded-lg border border-warning/40 bg-warning/10 p-5 text-center">
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warning" aria-hidden="true" />
            <p className="font-semibold">No tiene un salón asignado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : ''} Pida a Recursos Humanos que revise su asignación.
            </p>
          </div>
        ) : (
          <Suspense fallback={<PageLoader message="Cargando..." />}>
            <Outlet context={context} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
