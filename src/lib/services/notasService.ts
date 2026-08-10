import { supabase } from '../supabaseClient';
import { sessionService } from './sessionService';
import type {
  NotasArea,
  NotasCarrera,
  NotasDeclaracion,
  NotasImportLog,
  NotasRankingArea,
  NotasRow,
  NotasSemana,
} from '@/types/notas';

function requireApiToken(): string | null {
  return sessionService.getApiToken();
}

function mapSemana(raw: Record<string, unknown>): NotasSemana {
  return {
    id: Number(raw.id),
    codigo: String(raw.codigo ?? ''),
    etiqueta: String(raw.etiqueta ?? ''),
    fechaInicio: String(raw.fechaInicio ?? '').slice(0, 10),
    fechaFin: String(raw.fechaFin ?? '').slice(0, 10),
    abiertaDeclaracion: raw.abiertaDeclaracion !== false,
    abiertaCargaNotas: raw.abiertaCargaNotas !== false,
    activo: raw.activo !== false,
  };
}

export const notasService = {
  async listAreas(): Promise<{ areas: NotasArea[]; error: string | null }> {
    if (!requireApiToken()) return { areas: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_listar_areas');
      if (error) return { areas: [], error: error.message };
      const payload = data as { ok?: boolean; areas?: NotasArea[]; error?: string };
      if (!payload?.ok) return { areas: [], error: payload?.error || 'Error' };
      return { areas: payload.areas || [], error: null };
    } catch (e) {
      return { areas: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async listCarreras(areaId?: number | null): Promise<{ carreras: NotasCarrera[]; error: string | null }> {
    if (!requireApiToken()) return { carreras: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_listar_carreras', {
        p_area_id: areaId ?? null,
      });
      if (error) return { carreras: [], error: error.message };
      const payload = data as { ok?: boolean; carreras?: NotasCarrera[]; error?: string };
      if (!payload?.ok) return { carreras: [], error: payload?.error || 'Error' };
      return { carreras: payload.carreras || [], error: null };
    } catch (e) {
      return { carreras: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async listSemanas(soloActivas = true): Promise<{ semanas: NotasSemana[]; error: string | null }> {
    if (!requireApiToken()) return { semanas: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_listar_semanas', {
        p_solo_activas: soloActivas,
      });
      if (error) return { semanas: [], error: error.message };
      const payload = data as { ok?: boolean; semanas?: Record<string, unknown>[]; error?: string };
      if (!payload?.ok) return { semanas: [], error: payload?.error || 'Error' };
      return { semanas: (payload.semanas || []).map(mapSemana), error: null };
    } catch (e) {
      return { semanas: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async upsertSemana(input: {
    id?: number | null;
    codigo?: string;
    etiqueta?: string;
    fechaInicio?: string;
    fechaFin?: string;
    abiertaDeclaracion?: boolean;
    abiertaCargaNotas?: boolean;
    activo?: boolean;
  }): Promise<{ semana: NotasSemana | null; error: string | null }> {
    if (!requireApiToken()) return { semana: null, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_upsert_semana', {
        p_id: input.id ?? null,
        p_codigo: input.codigo ?? null,
        p_etiqueta: input.etiqueta ?? null,
        p_fecha_inicio: input.fechaInicio ?? null,
        p_fecha_fin: input.fechaFin ?? null,
        p_abierta_declaracion: input.abiertaDeclaracion ?? null,
        p_abierta_carga_notas: input.abiertaCargaNotas ?? null,
        p_activo: input.activo ?? null,
      });
      if (error) return { semana: null, error: error.message };
      const payload = data as { ok?: boolean; semana?: Record<string, unknown>; error?: string };
      if (!payload?.ok) return { semana: null, error: payload?.error || 'Error al guardar' };
      return { semana: payload.semana ? mapSemana(payload.semana) : null, error: null };
    } catch (e) {
      return { semana: null, error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async listDeclaraciones(semanaId: number): Promise<{ declaraciones: NotasDeclaracion[]; error: string | null }> {
    if (!requireApiToken()) return { declaraciones: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_listar_declaraciones', {
        p_semana_id: semanaId,
      });
      if (error) return { declaraciones: [], error: error.message };
      const payload = data as { ok?: boolean; declaraciones?: NotasDeclaracion[]; error?: string };
      if (!payload?.ok) return { declaraciones: [], error: payload?.error || 'Error' };
      return { declaraciones: payload.declaraciones || [], error: null };
    } catch (e) {
      return { declaraciones: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async upsertDeclaraciones(
    semanaId: number,
    filas: Array<{ id_estudiante: number; area_id: number; carrera_id?: number | null }>,
  ): Promise<{ okCount: number; failCount: number; error: string | null }> {
    if (!requireApiToken()) return { okCount: 0, failCount: 0, error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_upsert_declaraciones', {
        p_semana_id: semanaId,
        p_filas: filas,
      });
      if (error) return { okCount: 0, failCount: 0, error: error.message };
      const payload = data as { ok?: boolean; okCount?: number; failCount?: number; error?: string };
      if (!payload?.ok) return { okCount: 0, failCount: 0, error: payload?.error || 'Error' };
      return {
        okCount: Number(payload.okCount) || 0,
        failCount: Number(payload.failCount) || 0,
        error: null,
      };
    } catch (e) {
      return { okCount: 0, failCount: 0, error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async listNotas(
    semanaId: number,
    areaId?: number | null,
  ): Promise<{ notas: NotasRow[]; error: string | null }> {
    if (!requireApiToken()) return { notas: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_listar', {
        p_semana_id: semanaId,
        p_area_id: areaId ?? null,
      });
      if (error) return { notas: [], error: error.message };
      const payload = data as { ok?: boolean; notas?: NotasRow[]; error?: string };
      if (!payload?.ok) return { notas: [], error: payload?.error || 'Error' };
      return { notas: payload.notas || [], error: null };
    } catch (e) {
      return { notas: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async upsertLote(
    semanaId: number,
    filas: Array<{
      id_estudiante: number;
      nota: number;
      observacion?: string | null;
      carrera_nombre?: string | null;
      area_codigo?: string | null;
      match_status?: string;
    }>,
    nombreArchivo?: string | null,
  ): Promise<{
    filasOk: number;
    filasSinMatch: number;
    filasSinDeclaracion: number;
    filasAmbiguas: number;
    error: string | null;
  }> {
    if (!requireApiToken()) {
      return {
        filasOk: 0,
        filasSinMatch: 0,
        filasSinDeclaracion: 0,
        filasAmbiguas: 0,
        error: 'Sin sesión',
      };
    }
    try {
      const { data, error } = await supabase.rpc('sie_notas_upsert_lote', {
        p_semana_id: semanaId,
        p_filas: filas,
        p_nombre_archivo: nombreArchivo ?? null,
      });
      if (error) {
        return {
          filasOk: 0,
          filasSinMatch: 0,
          filasSinDeclaracion: 0,
          filasAmbiguas: 0,
          error: error.message,
        };
      }
      const payload = data as {
        ok?: boolean;
        filasOk?: number;
        filasSinMatch?: number;
        filasSinDeclaracion?: number;
        filasAmbiguas?: number;
        error?: string;
      };
      if (!payload?.ok) {
        return {
          filasOk: 0,
          filasSinMatch: 0,
          filasSinDeclaracion: 0,
          filasAmbiguas: 0,
          error: payload?.error || 'Error',
        };
      }
      return {
        filasOk: Number(payload.filasOk) || 0,
        filasSinMatch: Number(payload.filasSinMatch) || 0,
        filasSinDeclaracion: Number(payload.filasSinDeclaracion) || 0,
        filasAmbiguas: Number(payload.filasAmbiguas) || 0,
        error: null,
      };
    } catch (e) {
      return {
        filasOk: 0,
        filasSinMatch: 0,
        filasSinDeclaracion: 0,
        filasAmbiguas: 0,
        error: e instanceof Error ? e.message : 'Error de red',
      };
    }
  },

  async ranking(
    semanaId: number,
    limit = 10,
  ): Promise<{ porArea: NotasRankingArea[]; error: string | null }> {
    if (!requireApiToken()) return { porArea: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_ranking', {
        p_semana_id: semanaId,
        p_limit: limit,
      });
      if (error) return { porArea: [], error: error.message };
      const payload = data as { ok?: boolean; porArea?: NotasRankingArea[]; error?: string };
      if (!payload?.ok) return { porArea: [], error: payload?.error || 'Error' };
      return { porArea: payload.porArea || [], error: null };
    } catch (e) {
      return { porArea: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },

  async listImportLogs(limit = 20): Promise<{ logs: NotasImportLog[]; error: string | null }> {
    if (!requireApiToken()) return { logs: [], error: 'Sin sesión' };
    try {
      const { data, error } = await supabase.rpc('sie_notas_import_logs', {
        p_limit: limit,
      });
      if (error) return { logs: [], error: error.message };
      const payload = data as { ok?: boolean; logs?: NotasImportLog[]; error?: string };
      if (!payload?.ok) return { logs: [], error: payload?.error || 'Error' };
      return { logs: payload.logs || [], error: null };
    } catch (e) {
      return { logs: [], error: e instanceof Error ? e.message : 'Error de red' };
    }
  },
};
