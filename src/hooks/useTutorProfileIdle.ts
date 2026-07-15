import { useCallback, useEffect, useRef } from 'react';
import { sessionService } from '@/lib/services';

type UseTutorProfileIdleOptions = {
  active: boolean;
  onIdle: () => void;
  timeoutMs?: number;
};

/**
 * Oculta el perfil del alumno en el escáner del tutor tras unos segundos sin actividad.
 */
export function useTutorProfileIdle({
  active,
  onIdle,
  timeoutMs = sessionService.TUTOR_PROFILE_IDLE_MS,
}: UseTutorProfileIdleOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const bump = useCallback(() => {
    if (!active) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      onIdleRef.current();
    }, timeoutMs);
  }, [active, timeoutMs]);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }

    bump();

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'] as const;
    activityEvents.forEach((event) => {
      document.addEventListener(event, bump, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach((event) => {
        document.removeEventListener(event, bump);
      });
    };
  }, [active, bump]);

  return bump;
}
