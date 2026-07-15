import { supabase } from '../supabaseClient';
import type { ConfiguracionSistemaDB, SystemConfig } from '@/types';
import type { SystemSettingKey } from '@/config/systemSettings';
import { coerceTimeConfigValue } from '@/config/systemSettings';
import { getCached, invalidateCache, setCached } from '@/lib/utils/memoryCache';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';

const CONFIG_CACHE_TTL = 15 * 60 * 1000; // 15 minutos
const CONFIG_TABLES = ['configuracion_sistema'] as const;

async function selectConfigRowsByKeys(
  keys: string[],
): Promise<{ rows: ConfiguracionSistemaDB[]; error: string | null }> {
  const found = new Map<string, ConfiguracionSistemaDB>();
  let lastError: string | null = null;

  for (const table of CONFIG_TABLES) {
    const missing = keys.filter((key) => !found.has(key));
    if (missing.length === 0) break;

    const { data, error } = await supabase.from(table).select('*').in('clave', missing);
    if (error) {
      if (/does not exist|schema cache|PGRST205/i.test(error.message)) continue;
      if (error.code === 'PGRST205') continue;
      lastError = error.message;
      break;
    }
    for (const row of data ?? []) {
      found.set(row.clave, row as ConfiguracionSistemaDB);
    }
  }

  return { rows: [...found.values()], error: lastError };
}

/**
 * Servicio para gestionar la configuración del sistema
 */

/**
 * Convierte un registro de configuración de DB a formato frontend
 */
function resolveConfigId(config: ConfiguracionSistemaDB): number | null {
  const raw = config.id_config ?? (config as ConfiguracionSistemaDB & { id?: number }).id;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function mapSystemConfig(config: ConfiguracionSistemaDB): SystemConfig {
  return {
    id: resolveConfigId(config) ?? 0,
    key: config.clave,
    value: coerceTimeConfigValue(config.valor),
    description: config.descripcion ?? undefined,
    updatedAt: config.fecha_actualizacion,
  };
}

/**
 * Obtener todas las configuraciones del sistema
 */
export async function getAll(): Promise<{ configs: SystemConfig[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('*')
      .order('clave', { ascending: true });

    if (error) {
      console.error('Error al obtener configuraciones:', error);
      return { configs: [], error: error.message };
    }

    const configs = (data || []).map(mapSystemConfig);
    return { configs, error: null };
  } catch (error: any) {
    console.error('Error al obtener configuraciones:', error);
    return { configs: [], error: error.message };
  }
}

/**
 * Obtener varias configuraciones por clave en una sola consulta.
 */
export async function getByKeys(
  keys: string[],
): Promise<{ configs: Record<string, SystemConfig>; error: string | null }> {
  const uniqueKeys = [...new Set(keys)];
  const configs: Record<string, SystemConfig> = {};
  const missing: string[] = [];

  for (const key of uniqueKeys) {
    const cached = getCached<SystemConfig>(`config:${key}`);
    if (cached) {
      configs[key] = cached;
    } else {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    return { configs, error: null };
  }

  try {
    await ensureSupabaseReady();
    const { rows, error } = await selectConfigRowsByKeys(missing);

    if (error) {
      console.error('Error al obtener configuraciones:', error);
      return { configs, error };
    }

    for (const row of rows) {
      const config = mapSystemConfig(row);
      configs[config.key] = config;
      setCached(`config:${config.key}`, config, CONFIG_CACHE_TTL);
    }

    return { configs, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al obtener configuraciones:', error);
    return { configs, error: message };
  }
}

/**
 * Obtener una configuración por clave
 */
export async function getByKey(key: string): Promise<{ config: SystemConfig | null; error: string | null }> {
  const cacheKey = `config:${key}`;
  const cached = getCached<SystemConfig>(cacheKey);
  if (cached) {
    return { config: cached, error: null };
  }

  try {
    for (const table of CONFIG_TABLES) {
      const { data, error } = await supabase.from(table).select('*').eq('clave', key).maybeSingle();
      if (error) {
        if (/does not exist|schema cache|PGRST205/i.test(error.message)) continue;
        if (error.code === 'PGRST205') continue;
        console.error('Error al obtener configuración:', error);
        return { config: null, error: error.message };
      }
      if (data) {
        const config = mapSystemConfig(data);
        setCached(cacheKey, config, CONFIG_CACHE_TTL);
        return { config, error: null };
      }
    }

    return { config: null, error: null };
  } catch (error: any) {
    console.error('Error al obtener configuración:', error);
    return { config: null, error: error.message };
  }
}

/**
 * Crear una nueva configuración
 */
export async function create(data: {
  key: string;
  value: string;
  description?: string;
}): Promise<{ config: SystemConfig | null; error: string | null }> {
  try {
    const { data: newConfig, error } = await supabase
      .from('configuracion_sistema')
      .insert({
        clave: data.key,
        valor: data.value,
        descripcion: data.description,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear configuración:', error);
      return { config: null, error: error.message };
    }

    return { config: mapSystemConfig(newConfig), error: null };
  } catch (error: any) {
    console.error('Error al crear configuración:', error);
    return { config: null, error: error.message };
  }
}

/**
 * Actualizar una configuración existente
 */
export async function update(
  id: number,
  data: {
    value: string;
    description?: string;
  }
): Promise<{ config: SystemConfig | null; error: string | null }> {
  if (!Number.isFinite(id) || id <= 0) {
    return { config: null, error: 'ID de configuración inválido' };
  }

  try {
    const { data: updatedConfig, error } = await supabase
      .from('configuracion_sistema')
      .update({
        valor: data.value,
        descripcion: data.description,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id_config', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar configuración:', error);
      return { config: null, error: error.message };
    }

    return { config: mapSystemConfig(updatedConfig), error: null };
  } catch (error: any) {
    console.error('Error al actualizar configuración:', error);
    return { config: null, error: error.message };
  }
}

/**
 * Eliminar una configuración
 */
/**
 * Crea o actualiza un parámetro por clave (upsert lógico).
 */
export async function upsertByKey(data: {
  key: SystemSettingKey | string;
  value: string;
  description?: string;
}): Promise<{ config: SystemConfig | null; error: string | null }> {
  const cacheKey = `config:${data.key}`;

  try {
    await ensureSupabaseReady();
    const { data: row, error } = await supabase
      .from('configuracion_sistema')
      .upsert(
        {
          clave: data.key,
          valor: data.value,
          descripcion: data.description ?? null,
          fecha_actualizacion: new Date().toISOString(),
        },
        { onConflict: 'clave' },
      )
      .select()
      .single();

    if (error) {
      console.error('Error al guardar configuración:', error);
      return { config: null, error: error.message };
    }

    invalidateCache(cacheKey);
    return { config: mapSystemConfig(row), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error al guardar configuración:', error);
    return { config: null, error: message };
  }
}

export async function deleteConfig(id: number): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('configuracion_sistema')
      .delete()
      .eq('id_config', id);

    if (error) {
      console.error('Error al eliminar configuración:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error al eliminar configuración:', error);
    return { success: false, error: error.message };
  }
}

export const configService = {
  getAll,
  getByKeys,
  getByKey,
  create,
  update,
  upsertByKey,
  delete: deleteConfig,
};
