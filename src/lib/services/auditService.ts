import { supabase } from '../supabaseClient';
import { sessionService } from './sessionService';
import type { AuditLog, AuditoriaLogDB } from '@/types';

/**
 * Servicio para gestionar logs de auditoría
 */

/**
 * Convierte un log de auditoría de DB a formato frontend
 */
function mapAuditLog(log: AuditoriaLogDB & { cambios?: number | null }): AuditLog {
  return {
    id: log.id_log,
    table: log.tabla_afectada,
    recordId: log.id_registro,
    operation: log.accion,
    previousData: log.datos_anteriores ?? null,
    newData: log.datos_nuevos ?? null,
    userId: log.id_usuario || undefined,
    actionDescription: log.descripcion_accion || undefined,
    ipAddress: log.ip_address || undefined,
    timestamp: log.fecha_hora,
    changesCount: log.cambios ?? undefined,
  };
}

/**
 * Obtener logs de auditoría con filtros (sin el JSON de cambios; ver getAuditLogDetail).
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
  const token = sessionService.getApiToken();
  if (!token) {
    return { logs: [], total: 0, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
  }
  try {
    const { data, error } = await supabase.rpc('sie_auditoria_pagina', {
      p_token: token,
      p_filtros: {
        table: filters?.table ?? null,
        operation: filters?.operation ?? null,
        startDate: filters?.startDate ?? null,
        endDate: filters?.endDate ?? null,
        limit: filters?.limit || 50,
        offset: filters?.offset || 0,
      },
    });

    if (error) {
      console.error('Error al obtener logs de auditoría:', error);
      return { logs: [], total: 0, error: error.message };
    }

    const payload = (data ?? {}) as { logs?: unknown; total?: number; error?: string | null };
    if (payload.error) return { logs: [], total: 0, error: payload.error };
    const rows = (Array.isArray(payload.logs) ? payload.logs : []) as Array<
      AuditoriaLogDB & { cambios?: number | null }
    >;
    return { logs: rows.map(mapAuditLog), total: Number(payload.total) || 0, error: null };
  } catch (error: any) {
    console.error('Error al obtener logs de auditoría:', error);
    return { logs: [], total: 0, error: error.message };
  }
}

/** Un log con datos anteriores y nuevos, para el diálogo de detalle. */
export async function getAuditLogDetail(id: number): Promise<{ log: AuditLog | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('auditoria_logs')
      .select('*')
      .eq('id_log', id)
      .maybeSingle();
    if (error) return { log: null, error: error.message };
    if (!data) return { log: null, error: 'No se encontró el registro de auditoría' };
    return { log: mapAuditLog(data as AuditoriaLogDB), error: null };
  } catch (error: any) {
    return { log: null, error: error.message };
  }
}

/** Logs completos (con JSON) de una lista corta de ids, para exportar la página visible. */
export async function getAuditLogsWithData(ids: number[]): Promise<{ logs: AuditLog[]; error: string | null }> {
  if (ids.length === 0) return { logs: [], error: null };
  try {
    const { data, error } = await supabase
      .from('auditoria_logs')
      .select('*')
      .in('id_log', ids)
      .order('fecha_hora', { ascending: false });
    if (error) return { logs: [], error: error.message };
    return { logs: (data ?? []).map((row) => mapAuditLog(row as AuditoriaLogDB)), error: null };
  } catch (error: any) {
    return { logs: [], error: error.message };
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
  const token = sessionService.getApiToken();
  if (!token) {
    return { stats: null, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
  }
  try {
    const { data, error } = await supabase.rpc('sie_auditoria_stats', {
      p_token: token,
      p_dias: days,
    });

    if (error) {
      console.error('Error al obtener estadísticas de auditoría:', error);
      return { stats: null, error: error.message };
    }

    const payload = (data ?? {}) as {
      totalOperations?: number;
      inserts?: number;
      updates?: number;
      deletes?: number;
      byTable?: Record<string, number>;
      error?: string | null;
    };
    if (payload.error) return { stats: null, error: payload.error };

    return {
      stats: {
        totalOperations: Number(payload.totalOperations) || 0,
        inserts: Number(payload.inserts) || 0,
        updates: Number(payload.updates) || 0,
        deletes: Number(payload.deletes) || 0,
        byTable: payload.byTable ?? {},
      },
      error: null,
    };
  } catch (error: any) {
    console.error('Error al obtener estadísticas de auditoría:', error);
    return { stats: null, error: error.message };
  }
}

export const auditService = {
  getAuditLogs,
  getAuditLogDetail,
  getAuditLogsWithData,
  getAuditStats,
};
