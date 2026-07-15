import { useEffect, useRef } from 'react';

const BUILD_VERSION = import.meta.env.VITE_BUILD_ID ?? 'dev';

/**
 * Tras un deploy, recarga la pestaña si hay una versión nueva en el servidor.
 * Comprueba al volver a la pestaña y cada 5 min (sin pedir Ctrl+F5 al usuario).
 */
export function useDeployVersionCheck() {
  const checking = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || BUILD_VERSION === 'dev') return;

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const res = await fetch(`/build-version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (data.version && data.version !== BUILD_VERSION) {
          window.location.reload();
        }
      } catch {
        // Red caída: ignorar; se reintenta en el próximo ciclo.
      } finally {
        checking.current = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(check, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, []);
}
