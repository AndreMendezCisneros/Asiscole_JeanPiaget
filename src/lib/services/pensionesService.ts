import { supabase } from '../supabaseClient';
import type {
  PensionConfig,
  PensionEstado,
  PensionImportLog,
  PensionImportModo,
  PensionRow,
} from '@/types';
import { sessionService } from './sessionService';

function requireApiToken(): string | null {
  return sessionService.getApiToken();
}

function mapConfig(raw: Record<string, unknown> | null | undefined): PensionConfig {
  return {
    diaVencimiento: Number(raw?.diaVencimiento) || 10,
    montoMensual:
      raw?.montoMensual == null || raw.montoMensual === ''
        ? null
        : Number(raw.montoMensual),
    moneda: String(raw?.moneda ?? 'PEN'),
    avisoSonoroActivo: raw?.avisoSonoroActivo !== false,
    activo: raw?.activo !== false,
  };
}

function mapRow(raw: Record<string, unknown>): PensionRow {
  const pagadoRaw = Number(raw.pagado);
  return {
    id: Number(raw.id),
    idEstudiante: Number(raw.idEstudiante),
    periodo: String(raw.periodo ?? ''),
    fechaVencimiento: String(raw.fechaVencimiento ?? '').slice(0, 10),
    pagado: pagadoRaw === 1 ? 1 : 0,
    estado: (raw.estado as PensionEstado) || 'pendiente',
    monto: raw.monto == null ? null : Number(raw.monto),
    fechaPago: raw.fechaPago ? String(raw.fechaPago).slice(0, 10) : null,
    fuente: (raw.fuente as PensionRow['fuente']) || 'banco_excel',
    notas: (raw.notas as string | null) ?? null,
    registradoEn: String(raw.registradoEn ?? ''),
    nombreEstudiante: raw.nombreEstudiante ? String(raw.nombreEstudiante) : undefined,
    grado: raw.grado ? String(raw.grado) : undefined,
    seccion: raw.seccion ? String(raw.seccion) : undefined,
    barcode: raw.barcode ? String(raw.barcode) : undefined,
    contactPhone: (raw.contactPhone as string | null) ?? null,
    emergencyPhone: (raw.emergencyPhone as string | null) ?? null,
  };
}

export const pensionesService = {
  async getConfig(): Promise<{ config: PensionConfig | null; error: string | null }> {
    if (!requireApiToken()) return { config: null, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_get_config');
      if (error) return { config: null, error: error.message };
      const payload = data as { ok?: boolean; config?: Record<string, unknown>; error?: string };
      if (!payload?.ok) return { config: null, error: payload?.error || 'Error al leer config' };
      return { config: mapConfig(payload.config), error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async setConfig(input: {
    diaVencimiento?: number;
    montoMensual?: number | null;
    avisoSonoroActivo?: boolean;
    activo?: boolean;
  }): Promise<{ config: PensionConfig | null; error: string | null }> {
    if (!requireApiToken()) return { config: null, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_set_config', {
        p_dia_vencimiento: input.diaVencimiento ?? null,
        p_monto_mensual:
          input.montoMensual === null ? -1 : (input.montoMensual ?? null),
        p_aviso_sonoro_activo: input.avisoSonoroActivo ?? null,
        p_activo: input.activo ?? null,
      });
      if (error) return { config: null, error: error.message };
      const payload = data as { ok?: boolean; config?: Record<string, unknown>; error?: string };
      if (!payload?.ok) return { config: null, error: payload?.error || 'Error al guardar' };
      return { config: mapConfig(payload.config), error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async marcarMorosas(): Promise<{ actualizados: number; error: string | null }> {
    if (!requireApiToken()) return { actualizados: 0, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_marcar_morosas');
      if (error) return { actualizados: 0, error: error.message };
      const payload = data as { ok?: boolean; actualizados?: number; error?: string };
      if (!payload?.ok) return { actualizados: 0, error: payload?.error || 'Error' };
      return { actualizados: Number(payload.actualizados) || 0, error: null };
    } catch (err) {
      return { actualizados: 0, error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async listByPeriodo(
    periodo: string,
  ): Promise<{ rows: PensionRow[]; error: string | null }> {
    if (!requireApiToken()) return { rows: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_listar', {
        p_periodo: periodo,
      });
      if (error) return { rows: [], error: error.message };
      const payload = data as { ok?: boolean; rows?: unknown; error?: string };
      if (!payload?.ok) return { rows: [], error: payload?.error || 'Error al listar' };
      const rows = Array.isArray(payload.rows)
        ? payload.rows.map((r) => mapRow(r as Record<string, unknown>))
        : [];
      return { rows, error: null };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async historialAnio(
    idEstudiante: number,
    anio: number,
  ): Promise<{ rows: PensionRow[]; error: string | null }> {
    if (!requireApiToken()) return { rows: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_historial_anio', {
        p_id_estudiante: idEstudiante,
        p_anio: anio,
      });
      if (error) return { rows: [], error: error.message };
      const payload = data as { ok?: boolean; rows?: unknown; error?: string };
      if (!payload?.ok) return { rows: [], error: payload?.error || 'Error historial' };
      const rows = Array.isArray(payload.rows)
        ? payload.rows.map((r) => mapRow(r as Record<string, unknown>))
        : [];
      return { rows, error: null };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async importLote(input: {
    periodo: string;
    modo: PensionImportModo;
    nombreArchivo: string | null;
    filasSinMatch?: number;
    filasAmbiguas?: number;
    filas: Array<{
      id_estudiante: number;
      estado?: PensionEstado;
      pagado?: 0 | 1;
      monto?: number | null;
      fecha_pago?: string | null;
    }>;
  }): Promise<{ ok: boolean; importId?: number; filasOk?: number; error: string | null }> {
    if (!requireApiToken()) return { ok: false, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_upsert_lote', {
        p_periodo: input.periodo,
        p_modo: input.modo,
        p_filas: input.filas,
        p_nombre_archivo: input.nombreArchivo,
        p_filas_sin_match: input.filasSinMatch ?? 0,
        p_filas_ambiguas: input.filasAmbiguas ?? 0,
      });
      if (error) return { ok: false, error: error.message };
      const payload = data as {
        ok?: boolean;
        importId?: number;
        filasOk?: number;
        error?: string;
      };
      if (!payload?.ok) return { ok: false, error: payload?.error || 'Error al importar' };
      return {
        ok: true,
        importId: payload.importId,
        filasOk: payload.filasOk,
        error: null,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async updateManual(input: {
    id: number;
    pagado?: 0 | 1;
    estado?: PensionEstado;
    monto?: number | null;
    notas?: string | null;
  }): Promise<{ row: PensionRow | null; error: string | null }> {
    if (!requireApiToken()) return { row: null, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_actualizar_manual', {
        p_id: input.id,
        p_pagado: input.pagado ?? null,
        p_estado: input.estado ?? null,
        p_monto: input.monto ?? null,
        p_notas: input.notas ?? null,
      });
      if (error) return { row: null, error: error.message };
      const payload = data as { ok?: boolean; row?: Record<string, unknown>; error?: string };
      if (!payload?.ok) return { row: null, error: payload?.error || 'Error al actualizar' };
      return { row: payload.row ? mapRow(payload.row) : null, error: null };
    } catch (err) {
      return { row: null, error: err instanceof Error ? err.message : 'Error de red' };
    }
  },

  async listImportLogs(
    limit = 20,
  ): Promise<{ rows: PensionImportLog[]; error: string | null }> {
    if (!requireApiToken()) return { rows: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_pensiones_import_logs', {
        p_limit: limit,
      });
      if (error) return { rows: [], error: error.message };
      const payload = data as { ok?: boolean; rows?: unknown; error?: string };
      if (!payload?.ok) return { rows: [], error: payload?.error || 'Error logs' };
      const rows = Array.isArray(payload.rows)
        ? payload.rows.map((r) => {
            const raw = r as Record<string, unknown>;
            return {
              id: Number(raw.id),
              periodo: String(raw.periodo ?? ''),
              modo: (raw.modo as PensionImportModo) || 'pagaron',
              nombreArchivo: (raw.nombreArchivo as string | null) ?? null,
              filasLeidas: Number(raw.filasLeidas) || 0,
              filasOk: Number(raw.filasOk) || 0,
              filasSinMatch: Number(raw.filasSinMatch) || 0,
              filasAmbiguas: Number(raw.filasAmbiguas) || 0,
              importadoEn: String(raw.importadoEn ?? ''),
            } satisfies PensionImportLog;
          })
        : [];
      return { rows, error: null };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : 'Error de red' };
    }
  },
};
