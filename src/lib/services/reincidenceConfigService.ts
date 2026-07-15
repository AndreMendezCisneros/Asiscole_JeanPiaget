import { supabase } from '../supabaseClient';
import type { ConfiguracionReincidenciaDB, ReincidenceSettings } from '@/types';
import { getCached, invalidateCache, setCached } from '@/lib/utils/memoryCache';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';

const REINCIDENCE_CACHE_KEY = 'reincidence:settings';
const REINCIDENCE_CACHE_TTL = 15 * 60 * 1000;

const DEFAULT_CONFIG: Omit<ConfiguracionReincidenciaDB, 'id_configuracion_reincidencia' | 'id_config_reincidencia'> = {
  ventana_dias: 60,
  puntos_falta_leve: 1,
  puntos_falta_grave: 2,
  umbral_nivel_1: 1,
  umbral_nivel_2: 3,
  umbral_nivel_3: 5,
  umbral_nivel_4: 8,
  umbral_nivel_5: 12,
  activo: true,
  fecha_vigencia: new Date().toISOString(),
};

function resolveId(row: ConfiguracionReincidenciaDB): number | null {
  return row.id_configuracion_reincidencia ?? row.id_config_reincidencia ?? null;
}

function mapSettings(row: ConfiguracionReincidenciaDB): ReincidenceSettings {
  return {
    id: resolveId(row),
    windowDays: row.ventana_dias,
    thresholds: {
      level1: row.umbral_nivel_1,
      level2: row.umbral_nivel_2,
      level3: row.umbral_nivel_3,
      level4: row.umbral_nivel_4,
      level5: row.umbral_nivel_5,
    },
    active: row.activo,
  };
}

/**
 * Obtiene la configuración de reincidencia activa (ventana de días y umbrales).
 */
export async function getActive(): Promise<{
  settings: ReincidenceSettings | null;
  error: string | null;
}> {
  const cached = getCached<ReincidenceSettings>(REINCIDENCE_CACHE_KEY);
  if (cached) {
    return { settings: cached, error: null };
  }

  try {
    await ensureSupabaseReady();
    const { data, error } = await supabase
      .from('configuracion_reincidencia')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (error) {
      console.error('Error al obtener configuración de reincidencia:', error);
      return { settings: null, error: error.message };
    }

    if (!data) {
      return { settings: null, error: null };
    }

    const settings = mapSettings(data as ConfiguracionReincidenciaDB);
    setCached(REINCIDENCE_CACHE_KEY, settings, REINCIDENCE_CACHE_TTL);
    return { settings, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { settings: null, error: message };
  }
}

/**
 * Crea la configuración por defecto si no existe ninguna activa.
 */
export async function ensureDefault(): Promise<{
  settings: ReincidenceSettings | null;
  error: string | null;
}> {
  const existing = await getActive();
  if (existing.error) return existing;
  if (existing.settings) return existing;

  try {
    const { data, error } = await supabase
      .from('configuracion_reincidencia')
      .insert(DEFAULT_CONFIG)
      .select()
      .single();

    if (error) {
      console.error('Error al crear configuración de reincidencia:', error);
      return { settings: null, error: error.message };
    }

    const settings = mapSettings(data as ConfiguracionReincidenciaDB);
    setCached(REINCIDENCE_CACHE_KEY, settings, REINCIDENCE_CACHE_TTL);
    return { settings, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { settings: null, error: message };
  }
}

/**
 * Actualiza la ventana de días para el cálculo de reincidencia.
 */
function validateThresholds(thresholds: ReincidenceSettings['thresholds']): string | null {
  const values = [
    thresholds.level1,
    thresholds.level2,
    thresholds.level3,
    thresholds.level4,
    thresholds.level5,
  ];

  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 999)) {
    return 'Cada umbral debe ser un entero entre 1 y 999';
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) {
      return 'Los umbrales deben ser estrictamente crecientes (Nivel 1 < Nivel 2 < … < Nivel 5)';
    }
  }

  return null;
}

export async function updateSettings(input: {
  windowDays: number;
  thresholds: ReincidenceSettings['thresholds'];
}): Promise<{ settings: ReincidenceSettings | null; error: string | null }> {
  if (!Number.isInteger(input.windowDays) || input.windowDays < 7 || input.windowDays > 365) {
    return {
      settings: null,
      error: 'La ventana debe ser un número entero entre 7 y 365 días',
    };
  }

  const thresholdError = validateThresholds(input.thresholds);
  if (thresholdError) {
    return { settings: null, error: thresholdError };
  }

  const ensured = await ensureDefault();
  if (ensured.error) return { settings: null, error: ensured.error };
  if (!ensured.settings) {
    return { settings: null, error: 'No se pudo obtener la configuración de reincidencia' };
  }

  try {
    const { data, error } = await supabase
      .from('configuracion_reincidencia')
      .update({
        ventana_dias: input.windowDays,
        umbral_nivel_1: input.thresholds.level1,
        umbral_nivel_2: input.thresholds.level2,
        umbral_nivel_3: input.thresholds.level3,
        umbral_nivel_4: input.thresholds.level4,
        umbral_nivel_5: input.thresholds.level5,
      })
      .eq('activo', true)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error al actualizar configuración de reincidencia:', error);
      return { settings: null, error: error.message };
    }

    if (!data) {
      return { settings: null, error: 'No hay configuración activa para actualizar' };
    }

    const settings = mapSettings(data as ConfiguracionReincidenciaDB);
    invalidateCache(REINCIDENCE_CACHE_KEY);
    setCached(REINCIDENCE_CACHE_KEY, settings, REINCIDENCE_CACHE_TTL);
    return { settings, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { settings: null, error: message };
  }
}

/** @deprecated Use updateSettings */
export async function updateWindowDays(windowDays: number): Promise<{
  settings: ReincidenceSettings | null;
  error: string | null;
}> {
  const ensured = await ensureDefault();
  if (ensured.error || !ensured.settings) {
    return { settings: null, error: ensured.error ?? 'Sin configuración' };
  }
  return updateSettings({ windowDays, thresholds: ensured.settings.thresholds });
}

export const reincidenceConfigService = {
  getActive,
  ensureDefault,
  updateSettings,
  updateWindowDays,
};
