import { createClient } from '@supabase/supabase-js';
import { sessionService } from './services/sessionService';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://spdugaykkcgpcfslcpac.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHVnYXlra2NncGNmc2xjcGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDE5MzAsImV4cCI6MjA3NzUxNzkzMH0.zLC3qHpIeVSA0jsLcA_md87_0SV4-stpDjHF7IvBr28';

if (!import.meta.env.VITE_SUPABASE_URL && import.meta.env.PROD) {
  console.warn('[SIE] VITE_SUPABASE_URL no definida; usando valor por defecto del proyecto.');
}

/**
 * Timeout universal por petición: si una petición a Supabase se queda colgada
 * (red lenta, cold-start de Postgres), se cancela para que React Query pueda
 * reintentar. El reintento suele resolver en < 1 s porque la conexión ya está
 * "caliente".
 *
 * Usa AbortController + setTimeout en lugar de AbortSignal.timeout para garantizar
 * compatibilidad con TODOS los browsers (incluyendo iOS Safari < 16).
 */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Wrapper de fetch con timeout garantizado.
 * Crea un AbortController con un timer; si el timer dispara, aborta el fetch.
 * Limpia el timer si el fetch termina antes (éxito o error).
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(new DOMException('Request timed out', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );

  // Combinar con cualquier signal existente (e.g. señal de cancelación de React Query)
  let signal: AbortSignal = ctrl.signal;
  if (init?.signal) {
    const external = init.signal as AbortSignal;
    if (external.aborted) {
      clearTimeout(timer);
      ctrl.abort(external.reason);
    } else {
      external.addEventListener('abort', () => ctrl.abort(external.reason), { once: true });
    }
  }

  return fetch(input, { ...init, signal }).finally(() => clearTimeout(timer));
}

/**
 * Cliente Supabase. Envía x-sie-token en cada petición cuando hay sesión activa
 * para que las políticas RLS identifiquen rol y usuario.
 * Todas las peticiones tienen un timeout de REQUEST_TIMEOUT_MS para evitar
 * que se queden colgadas indefinidamente (cold-start de Supabase/Postgres).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      const apiToken = sessionService.getApiToken();
      const headers = new Headers(init?.headers);
      if (apiToken) {
        headers.set('x-sie-token', apiToken);
      }
      return fetchWithTimeout(input, { ...init, headers });
    },
  },
});
