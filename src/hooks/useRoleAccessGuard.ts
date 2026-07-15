import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '@/lib/services';
import { canAccessStaffRoute, getHomeRouteForRole } from '@/lib/utils/roleRoutes';

/**
 * Revalida el acceso al volver del historial (bfcache) o al cambiar de ruta.
 */
export function useRoleAccessGuard(requiredRole?: string[]) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const enforce = () => {
      const user = authService.getCurrentUser();
      if (!user) return;

      if (!canAccessStaffRoute(user.role, requiredRole)) {
        navigate(getHomeRouteForRole(user.role), { replace: true });
      }
    };

    enforce();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) enforce();
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [location.pathname, navigate, requiredRole]);
}
