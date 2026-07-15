import { supabase } from './supabaseClient';
import { sessionService } from './services/sessionService';

let warmupPromise: Promise<void> | null = null;

/**
 * Calienta Supabase/Postgres una sola vez por sesión antes de consultas pesadas.
 * Todas las páginas staff comparten la misma promesa: no compiten en frío a la vez.
 */
export function ensureSupabaseReady(): Promise<void> {
  if (!sessionService.getApiToken()) {
    return Promise.resolve();
  }
  if (!warmupPromise) {
    warmupPromise = runWarmup().catch((err) => {
      warmupPromise = null;
      throw err;
    });
  }
  return warmupPromise;
}

/** Permite un nuevo warmup tras cerrar sesión o si el anterior falló. */
export function resetSupabaseWarmup(): void {
  warmupPromise = null;
}

async function runWarmup(): Promise<void> {
  // 1) Ping mínimo con token RLS (misma ruta que login/sesión)
  const ping = await supabase
    .from('catalogo_faltas')
    .select('id_falta')
    .eq('activo', true)
    .limit(1);
  if (ping.error) {
    throw new Error(ping.error.message);
  }

  // 2) Tablas que usan las páginas de incidencias — en paralelo, con conexión ya abierta
  const [inc, est] = await Promise.all([
    supabase.from('incidencias').select('id_incidencia', { count: 'exact', head: true }).limit(0),
    supabase.from('estudiantes').select('id_estudiante').limit(1),
  ]);
  if (inc.error) throw new Error(inc.error.message);
  if (est.error) throw new Error(est.error.message);
}
