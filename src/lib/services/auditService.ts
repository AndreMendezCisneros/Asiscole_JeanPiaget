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

    const { data, error } = await supabase
      .from('auditoria_logs')
      .select('accion, tabla_afectada')
      .gte('fecha_hora', startDate.toISOString());

    if (error) {
      console.error('Error al obtener estadísticas de auditoría:', error);
      return { stats: null, error: error.message };
    }

    const stats = {
      totalOperations: data.length,
      inserts: data.filter((log) => log.accion === 'INSERT').length,
      updates: data.filter((log) => log.accion === 'UPDATE').length,
      deletes: data.filter((log) => log.accion === 'DELETE').length,
      byTable: data.reduce((acc, log) => {
        acc[log.tabla_afectada] = (acc[log.tabla_afectada] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return { stats, error: null };
  } catch (error: any) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    return { stats: null, error: error.message };
  }
}

export const auditService = {
  getAuditLogs,
  getAuditStats,
};
