import { ReactNode, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService, sessionService } from '@/lib/services';
import { useParentPortalOptional } from '@/contexts/ParentPortalContext';
import { toast } from 'sonner';
import { useParentShellAnimation } from '@/hooks/useParentPortalAnimations';
import { GuardyMark } from '@/components/brand/GuardyMark';
import { SCHOOL_NAME } from '@/config/siteSeo';

interface ParentLayoutProps {
  children: ReactNode;
}

function parentHeaderSubtitle(childCount: number): string {
  if (childCount > 1) {
    return `${childCount} hijos/as a cargo · ${SCHOOL_NAME}`;
  }
  return `Portal familiar · ${SCHOOL_NAME}`;
}

/** Layout simple para apoderados: una sola cabecera, sin menú lateral de personal */
export function ParentLayout({ children }: ParentLayoutProps) {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const ctx = useParentPortalOptional();
  const shellRef = useRef<HTMLDivElement>(null);
  useParentShellAnimation(shellRef);

  const childCount = ctx?.students.length ?? 0;
  const subtitle = parentHeaderSubtitle(childCount);

  const handleLogout = async () => {
    await authService.logout();
    toast.success('Sesión cerrada');
    navigate('/login', { replace: true });
  };

  return (
    <div className="parent-shell min-h-screen bg-[hsl(var(--background))]" ref={shellRef}>
      <div className="parent-shell__glow pointer-events-none" data-parent-shell-glow aria-hidden />
      <header
        className="parent-shell__header sticky top-0 z-30 border-b border-border/70 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90"
        role="banner"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3" data-parent-shell-anim>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15"
              aria-hidden
            >
              <GuardyMark size="sm" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.fullName ?? 'Apoderado'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            data-parent-shell-anim
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      <main
        id="parent-main"
        className="parent-shell__main mx-auto w-full max-w-3xl px-4 py-3 pb-28 sm:px-6 sm:py-4 sm:pb-8"
        role="main"
        aria-describedby="parent-session-hint"
      >
        <p id="parent-session-hint" className="sr-only">
          Por su seguridad, la sesión se cierra automáticamente tras{' '}
          {Math.round(sessionService.PARENT_SESSION_DURATION / 60000)} minutos sin actividad.
        </p>
        {children}
      </main>
    </div>
  );
}
