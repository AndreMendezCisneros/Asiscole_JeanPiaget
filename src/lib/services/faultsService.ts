import { supabase } from '../supabaseClient';
import { FaultType, CatalogoFaltaDB, FaultCategory } from '@/types';
import { getCached, invalidateCache, setCached } from '@/lib/utils/memoryCache';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import { configService } from './configService';
import {
  DEFAULT_FAULT_CATEGORIES,
  FAULT_CATEGORIES_CONFIG_KEY,
  mergeFaultCategories,
} from '@/lib/constants/faultCategories';

const FAULTS_CACHE_KEY = 'faults:active';
const FAULTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutos

function mapCategoriaError(error: { code?: string; message?: string } | null): string {
  const msg = error?.message ?? 'Error al guardar la falta';
  if (
    error?.code === '22P02' ||
    /invalid input value for enum categoria_falta/i.test(msg)
  ) {
    return (
      'La categoría no está permitida en la base de datos. ' +
      'Ejecute scripts/PATCH_CATEGORIA_FALTA_TEXT.sql en Supabase y reintente.'
    );
  }
  return msg;
}

/**
 * Servicio de catálogo de faltas
 */
export const faultsService = {
  /**
   * Obtener todas las faltas activas, ordenadas por categoría y orden visualización
   */
  async getAll(activeOnly: boolean = true): Promise<{ faults: FaultType[]; error: string | null }> {
    if (activeOnly) {
      const cached = getCached<FaultType[]>(FAULTS_CACHE_KEY);
      if (cached) {
        return { faults: cached, error: null };
      }
    }

    try {
      await ensureSupabaseReady();
      let query = supabase
        .from('catalogo_faltas')
        .select('*');

      if (activeOnly) {
        query = query.eq('activo', true);
      }

      const { data, error } = await query
        .order('categoria', { ascending: true })
        .order('orden_visualizacion', { ascending: true })
        .order('nombre_falta', { ascending: true });

      if (error) {
        invalidateCache(FAULTS_CACHE_KEY);
        return { faults: [], error: error.message };
      }

      const faults: FaultType[] = (data || []).map((falta: CatalogoFaltaDB) => ({
        id: falta.id_falta,
        name: falta.nombre_falta,
        description: falta.descripcion,
        category: falta.categoria,
        severity: falta.es_grave ? 'Grave' : 'Leve',
        points: falta.puntos_reincidencia,
        active: falta.activo,
        ordenVisualizacion: falta.orden_visualizacion,
      }));

      if (activeOnly && faults.length > 0) {
        setCached(FAULTS_CACHE_KEY, faults, FAULTS_CACHE_TTL);
      }

      return { faults, error: null };
    } catch (error: unknown) {
      invalidateCache(FAULTS_CACHE_KEY);
      const message = error instanceof Error ? error.message : 'Error al obtener faltas';
      console.error('Error en getAll:', error);
      return { faults: [], error: message };
    }
  },

  /**
   * Obtener faltas por categoría
   */
  async getByCategory(category: FaultCategory): Promise<{ faults: FaultType[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('catalogo_faltas')
        .select('*')
        .eq('categoria', category)
        .eq('activo', true)
        .order('orden_visualizacion', { ascending: true })
        .order('nombre_falta', { ascending: true });

      if (error) {
        return { faults: [], error: error.message };
      }

      const faults: FaultType[] = (data || []).map((falta: CatalogoFaltaDB) => ({
        id: falta.id_falta,
        name: falta.nombre_falta,
        description: falta.descripcion,
        category: falta.categoria,
        severity: falta.es_grave ? 'Grave' : 'Leve',
        points: falta.puntos_reincidencia,
        active: falta.activo,
        ordenVisualizacion: falta.orden_visualizacion,
      }));

      return { faults, error: null };
    } catch (error: any) {
      console.error('Error en getByCategory:', error);
      return { faults: [], error: error.message || 'Error al obtener faltas por categoría' };
    }
  },

  /**
   * Obtener falta por ID
   */
  async getById(id: number): Promise<{ fault: FaultType | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('catalogo_faltas')
        .select('*')
        .eq('id_falta', id)
        .single();

      if (error || !data) {
        return { fault: null, error: 'Falta no encontrada' };
      }

      const fault: FaultType = {
        id: data.id_falta,
        name: data.nombre_falta,
        description: data.descripcion,
        category: data.categoria,
        severity: data.es_grave ? 'Grave' : 'Leve',
        points: data.puntos_reincidencia,
        active: data.activo,
        ordenVisualizacion: data.orden_visualizacion,
      };

      return { fault, error: null };
    } catch (error: any) {
      console.error('Error en getById:', error);
      return { fault: null, error: error.message || 'Error al obtener falta' };
    }
  },

  /**
   * Crear nueva falta
   */
  async create(fault: {
    nombre_falta: string;
    categoria: FaultCategory;
    es_grave: boolean;
    puntos_reincidencia: number;
    descripcion?: string;
    orden_visualizacion?: number;
  }): Promise<{ fault: FaultType | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('catalogo_faltas')
        .insert({
          ...fault,
          activo: true,
          orden_visualizacion: fault.orden_visualizacion || 0,
        })
        .select()
        .single();

      if (error) {
        return { fault: null, error: mapCategoriaError(error) };
      }

      const newFault: FaultType = {
        id: data.id_falta,
        name: data.nombre_falta,
        description: data.descripcion,
        category: data.categoria,
        severity: data.es_grave ? 'Grave' : 'Leve',
        points: data.puntos_reincidencia,
        active: data.activo,
        ordenVisualizacion: data.orden_visualizacion,
      };

      invalidateCache(FAULTS_CACHE_KEY);
      return { fault: newFault, error: null };
    } catch (error: any) {
      console.error('Error en create:', error);
      return { fault: null, error: error.message || 'Error al crear falta' };
    }
  },

  /**
   * Actualizar falta
   */
  async update(
    id: number,
    updates: Partial<{
      nombre_falta: string;
      categoria: FaultCategory;
      es_grave: boolean;
      puntos_reincidencia: number;
      descripcion: string;
      orden_visualizacion: number;
      activo: boolean;
    }>
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('catalogo_faltas')
        .update(updates)
        .eq('id_falta', id);

      if (error) {
        return { success: false, error: mapCategoriaError(error) };
      }

      invalidateCache(FAULTS_CACHE_KEY);
      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en update:', error);
      return { success: false, error: error.message || 'Error al actualizar falta' };
    }
  },

  /**
   * Categorías guardadas en configuración (sin fusionar con faltas existentes)
   */
  async getStoredCategories(): Promise<{ categories: string[]; error: string | null }> {
    try {
      const { config, error } = await configService.getByKey(FAULT_CATEGORIES_CONFIG_KEY);
      if (error) {
        return { categories: [...DEFAULT_FAULT_CATEGORIES], error };
      }
      if (!config?.value) {
        return { categories: [...DEFAULT_FAULT_CATEGORIES], error: null };
      }
      const parsed = JSON.parse(config.value) as unknown;
      if (!Array.isArray(parsed)) {
        return { categories: [...DEFAULT_FAULT_CATEGORIES], error: null };
      }
      const categories = parsed.filter(
        (c): c is string => typeof c === 'string' && c.trim().length > 0,
      );
      return { categories: mergeFaultCategories(categories, []), error: null };
    } catch {
      return { categories: [...DEFAULT_FAULT_CATEGORIES], error: null };
    }
  },

  /**
   * Lista completa de categorías (config + faltas en catálogo)
   */
  async getCategories(faults: FaultType[]): Promise<{ categories: string[]; error: string | null }> {
    const { categories: stored, error } = await this.getStoredCategories();
    return { categories: mergeFaultCategories(stored, faults), error };
  },

  /**
   * Agregar una categoría personalizada
   */
  async addCategory(
    name: string,
    faults: FaultType[],
  ): Promise<{ categories: string[]; error: string | null }> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { categories: [], error: 'La categoría debe tener al menos 2 caracteres' };
    }
    if (trimmed.length > 50) {
      return { categories: [], error: 'Máximo 50 caracteres' };
    }

    const { categories: stored } = await this.getStoredCategories();
    const current = mergeFaultCategories(stored, faults);
    const normalized = trimmed.toLowerCase();
    if (current.some((c) => c.toLowerCase() === normalized)) {
      return { categories: current, error: 'Esa categoría ya existe' };
    }

    const next = mergeFaultCategories([...stored, trimmed], faults);
    const { error } = await configService.upsertByKey({
      key: FAULT_CATEGORIES_CONFIG_KEY,
      value: JSON.stringify(next),
      description: 'Categorías del catálogo de faltas',
    });

    if (error) {
      return { categories: stored, error };
    }

    return { categories: next, error: null };
  },

  /**
   * Eliminar (desactivar) falta
   */
  async delete(id: number): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('catalogo_faltas')
        .update({ activo: false })
        .eq('id_falta', id);

      if (error) {
        return { success: false, error: error.message };
      }

      invalidateCache(FAULTS_CACHE_KEY);
      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en delete:', error);
      return { success: false, error: error.message || 'Error al eliminar falta' };
    }
  },
};
