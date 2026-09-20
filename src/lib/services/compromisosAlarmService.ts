import { supabase } from '@/lib/supabaseClient';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import type {
  CompromisoAlarma,
  CompromisoAlarmaTipo,
  CompromisoBaselines,
} from '@/types/compromisoAlarma';

type CompromisoRow = {
  id: number;
  id_estudiante: number;
  tipo: CompromisoAlarmaTipo;
  nombre_apoderado: string;
  documento_url: string | null;
  firmado_en: string;
  registrado_por: number | null;
  observaciones: string | null;
  activo: boolean;
  fecha_creacion: string;
};

function mapRow(row: CompromisoRow): CompromisoAlarma {
  return {
    id: row.id,
    studentId: row.id_estudiante,
    tipo: row.tipo,
    parentName: row.nombre_apoderado,
    documentUrl: row.documento_url,
    signedAt: row.firmado_en,
    registeredBy: row.registrado_por,
    observations: row.observaciones,
    active: row.activo,
    createdAt: row.fecha_creacion,
  };
}

export const compromisosAlarmService = {
  async getBaselines(studentId: number): Promise<{
    baselines: CompromisoBaselines;
    error: string | null;
  }> {
    try {
      await ensureSupabaseReady();
      const { data, error } = await supabase
        .from('compromisos_alarma')
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .eq('id_estudiante', studentId)
        .eq('activo', true)
        .order('firmado_en', { ascending: false });

      if (error) {
        // Tabla aún no desplegada: no cortar alarmas.
        if (/compromisos_alarma|does not exist|42P01/i.test(error.message)) {
          return {
            baselines: { tardanza: null, falta: null, pago: null },
            error: null,
          };
        }
        return {
          baselines: { tardanza: null, falta: null, pago: null },
          error: error.message,
        };
      }

      const baselines: CompromisoBaselines = {
        tardanza: null,
        falta: null,
        pago: null,
      };
      for (const raw of data ?? []) {
        const row = raw as CompromisoRow;
        if (!baselines[row.tipo]) {
          baselines[row.tipo] = row.firmado_en;
        }
      }
      return { baselines, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al leer compromisos';
      return { baselines: { tardanza: null, falta: null, pago: null }, error: message };
    }
  },

  /**
   * Si el alumno ya no está moroso, desactiva compromisos de pago
   * para que un nuevo atraso vuelva a disparar la alarma.
   */
  async syncPagoBaselinesForPension(
    studentId: number,
    isMoroso: boolean,
  ): Promise<void> {
    if (isMoroso) return;
    try {
      await ensureSupabaseReady();
      await supabase
        .from('compromisos_alarma')
        .update({ activo: false })
        .eq('id_estudiante', studentId)
        .eq('tipo', 'pago')
        .eq('activo', true);
    } catch {
      /* silencioso */
    }
  },

  async listForStudent(
    studentId: number,
  ): Promise<{ items: CompromisoAlarma[]; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const { data, error } = await supabase
        .from('compromisos_alarma')
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .eq('id_estudiante', studentId)
        .order('firmado_en', { ascending: false })
        .limit(50);
      if (error) return { items: [], error: error.message };
      return { items: (data as CompromisoRow[]).map(mapRow), error: null };
    } catch (e: unknown) {
      return {
        items: [],
        error: e instanceof Error ? e.message : 'Error al listar compromisos',
      };
    }
  },

  async registerSigned(input: {
    studentId: number;
    tipo: CompromisoAlarmaTipo;
    parentName: string;
    registeredBy?: number | null;
    observations?: string | null;
    documentUrl?: string | null;
    signedAt?: string | null;
  }): Promise<{ item: CompromisoAlarma | null; error: string | null }> {
    try {
      await ensureSupabaseReady();
      const parentName = input.parentName.trim();
      if (parentName.length < 3) {
        return { item: null, error: 'Indique el nombre del apoderado (mín. 3 caracteres).' };
      }

      // Un solo activo por tipo: desactivar anteriores del mismo tipo.
      await supabase
        .from('compromisos_alarma')
        .update({ activo: false })
        .eq('id_estudiante', input.studentId)
        .eq('tipo', input.tipo)
        .eq('activo', true);

      const { data, error } = await supabase
        .from('compromisos_alarma')
        .insert({
          id_estudiante: input.studentId,
          tipo: input.tipo,
          nombre_apoderado: parentName,
          documento_url: input.documentUrl ?? null,
          firmado_en: input.signedAt || new Date().toISOString(),
          registrado_por: input.registeredBy ?? null,
          observaciones: input.observations?.trim() || null,
          activo: true,
        })
        .select(
          'id, id_estudiante, tipo, nombre_apoderado, documento_url, firmado_en, registrado_por, observaciones, activo, fecha_creacion',
        )
        .single();

      if (error) return { item: null, error: error.message };
      return { item: mapRow(data as CompromisoRow), error: null };
    } catch (e: unknown) {
      return {
        item: null,
        error: e instanceof Error ? e.message : 'Error al registrar el compromiso',
      };
    }
  },
};
