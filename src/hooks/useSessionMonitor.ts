import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, sessionService } from '@/lib/services';

const ACTIVITY_THROTTLE_MS = 1000;

/**
 * Cierra la sesión tras inactividad real (sin renovar el temporizador en segundo plano).
 * Tutor y padre: 15 min · resto de roles: 30 min.
 */
export const useSessionMonitor = () => {
  const navigate = useNavigate();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchRef = useRef(0);

  const logoutExpired = useCallback(() => {
    const role = sessionService.readSessionRaw()?.user.role;
    void authService.logout();
    const roleQuery =
      role === 'Tutor'
        ? '&role=tutor'
        : role === 'Docente'
          ? '&role=docente'
          : role === 'Padre'
            ? '&role=padre'
            : '';
    navigate(`/login?expired=true${roleQuery}`, { replace: true });
  }, [navigate]);

  const scheduleIdleLogout = useCallback(() => {
    const session = sessionService.readSessionRaw();
    if (!session) return;

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      logoutExpired();
      return;
    }

    idleTimerRef.current = setTimeout(logoutExpired, remaining);
  }, [logoutExpired]);

  const onUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastTouchRef.current < ACTIVITY_THROTTLE_MS) return;
    lastTouchRef.current = now;

    if (sessionService.isExpired()) {
      logoutExpired();
      return;
    }

    sessionService.touchActivity();
    scheduleIdleLogout();
    // Desliza también la ventana en el servidor (autolimitado a 1 vez cada pocos min)
    // para que el token no caduque mientras haya actividad real.
    authService.renewSessionThrottled();
  }, [logoutExpired, scheduleIdleLogout]);

  useEffect(() => {
    const session = sessionService.getSession();
    if (!session) return;

    scheduleIdleLogout();

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    activityEvents.forEach((event) => {
      document.addEventListener(event, onUserActivity, { passive: true });
    });

    const intervalId = setInterval(() => {
      if (sessionService.isExpired()) {
        logoutExpired();
      }
    }, sessionService.REFRESH_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (sessionService.isExpired()) {
        logoutExpired();
        return;
      }
      sessionService.touchActivity();
      scheduleIdleLogout();
      authService.renewSessionThrottled();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, onUserActivity);
      });
    };
  }, [logoutExpired, onUserActivity, scheduleIdleLogout]);
};
