import { supabase } from '../supabaseClient';
import type { AuditLog, AuditoriaLogDB } from '@/types';

/**
 * Servicio para gestionar logs de auditoría
 */

/**
 * Convierte un log de auditoría de DB a formato frontend
 */
function mapAuditLog(log: AuditoriaLogDB): AuditLog {
  return {
    id: log.id_log,
    table: log.tabla_afectada,
    recordId: log.id_registro,
    operation: log.accion,
    previousData: log.datos_anteriores,
    newData: log.datos_nuevos,
    userId: log.id_usuario || undefined,
    actionDescription: log.descripcion_accion || undefined,
    ipAddress: log.ip_address || undefined,
    timestamp: log.fecha_hora,
  };
}

/**
 * Obtener logs de auditoría con filtros
 */
export async function getAuditLogs(filters?: {
  table?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ 
  logs: AuditLog[]; 
  total: number;
  error: string | null;
}> {
  try {
    let query = supabase
      .from('auditoria_logs')
      .select('*', { count: 'exact' })
      .order('fecha_hora', { ascending: false });

    if (filters?.table) {
      query = query.eq('tabla_afectada', filters.table);
    }

    if (filters?.operation) {
      query = query.eq('accion', filters.operation);
    }

    if (filters?.startDate) {
      query = query.gte('fecha_hora', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('fecha_hora', filters.endDate);
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener logs de auditoría:', error);
      return { logs: [], total: 0, error: error.message };
    }

    const logs = (data || []).map(mapAuditLog);
    return { logs, total: count || 0, error: null };
  } catch (error: any) {
    console.error('Error al obtener logs de auditoría:', error);
    return { logs: [], total: 0, error: error.message };
  }
}

/**
 * Obtener estadísticas de auditoría
 */
async function countAuditLogs(desde: string, accion?: 'INSERT' | 'UPDATE' | 'DELETE'): Promise<number> {
  let query = supabase
    .from('auditoria_logs')
    .select('id_log', { count: 'exact', head: true })
    .gte('fecha_hora', desde);
  if (accion) query = query.eq('accion', accion);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAuditStats(days: number = 7): Promise<{
  stats: {
    totalOperations: number;
    inserts: number;
    updates: number;
    deletes: number;
    byTable: Record<string, number>;
  } | null;
  error: string | null;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const desde = startDate.toISOString();

    const [totalOperations, inserts, updates, deletes] = await Promise.all([
      countAuditLogs(desde),
      countAuditLogs(desde, 'INSERT'),
      countAuditLogs(desde, 'UPDATE'),
      countAuditLogs(desde, 'DELETE'),
    ]);

    return {
      stats: { totalOperations, inserts, updates, deletes, byTable: {} },
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener estadísticas de auditoría';
    console.error('Error al obtener estadísticas de auditoría:', error);
    return { stats: null, error: message };
  }
}

/** Todas las filas del filtro, de a 500, para el Excel. */
export async function getAllAuditLogs(filters?: {
  table?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE';
  startDate?: string;
  endDate?: string;
}): Promise<{ logs: AuditLog[]; total: number; error: string | null }> {
  const pageSize = 500;
  const logs: AuditLog[] = [];
  let total = 0;
  let offset = 0;

  while (offset <= 20000) {
    const page = await getAuditLogs({ ...filters, limit: pageSize, offset });
    if (page.error) return { logs, total, error: page.error };
    total = page.total;
    logs.push(...page.logs);
    if (page.logs.length === 0 || logs.length >= total) break;
    offset += pageSize;
  }

  return { logs, total, error: null };
}

export const auditService = {
  getAuditLogs,
  getAuditStats,
  getAllAuditLogs,
};
