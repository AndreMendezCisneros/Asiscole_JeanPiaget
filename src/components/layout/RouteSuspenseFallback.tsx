import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { preloadRoute } from '@/lib/routePreloads';

const SLOW_LOAD_MS = 8_000;

/**
 * Fallback de Suspense por ruta: si el chunk tarda demasiado, ofrece reintentar.
 */
export function RouteSuspenseFallback() {
  const location = useLocation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setSlow(false);
    preloadRoute(location.pathname);

    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const handleRetry = () => {
    preloadRoute(location.pathname);
    window.location.assign(location.pathname);
  };

  if (!slow) {
    return <PageLoader message="Cargando…" />;
  }

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-medium text-foreground">La carga está tardando más de lo habitual</p>
        <p className="text-xs text-muted-foreground">
          Puede deberse a la red del colegio. Espere un momento o reintente la pantalla.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
        Reintentar carga
      </Button>
    </div>
  );
}
