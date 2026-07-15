import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GuardyMark } from '@/components/brand/GuardyMark';
import { cn } from '@/lib/utils';
import { authService } from '@/lib/services';
import { getHomeRouteForRole, isStaffRole } from '@/lib/utils/roleRoutes';
import { useRoleAccessGuard } from '@/hooks/useRoleAccessGuard';

interface LayoutProps {
  children: ReactNode;
  requiredRole?: string[];
}

export const Layout = ({ children, requiredRole }: LayoutProps) => {
  const { pathname } = useLocation();
  const user = authService.getCurrentUser();
  const isParentPortal = pathname.startsWith('/parent-portal');

  useRoleAccessGuard(requiredRole);

  if (user && !isStaffRole(user.role)) {
    return <Navigate to={getHomeRouteForRole(user.role)} replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          'flex min-h-screen flex-1 flex-col bg-gradient-to-b from-background via-background to-muted/12 transition-all duration-300 md:ml-64',
          isParentPortal && 'parent-layout-main bg-gradient-to-b from-muted/30 via-background to-background'
        )}
      >
        <div id="main-content" className="flex-1 pb-3 md:pb-4">
          {children}
        </div>
        <footer className="hidden border-t border-border/70 bg-card/55 px-6 py-2 md:flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/70 backdrop-blur">
          <GuardyMark size="xs" />
          <span>Guardy</span>
        </footer>
      </main>
    </div>
  );
};
