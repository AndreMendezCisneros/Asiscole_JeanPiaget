import { supabase } from '../supabaseClient';
import { getLimaDayRangeISO } from '@/lib/utils/limaDateTime';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import type { EstadoIncidencia } from '@/types';
import type { PersonalCategoria } from '@/types/personal';

export interface PersonalIncident {
  id: number;
  personalId: number;
  personalName: string;
  personalBarcode: string;
  personalCategory: PersonalCategoria | null;
  faultId: number;
  faultName: string;
  faultCategory: string | null;
  isSerious: boolean;
  registeredAt: string;
  registeredById: number;
  registeredByName: string | null;
  observations: string | null;
  status: EstadoIncidencia;
  resolutionReason: string | null;
  automatic: boolean;
}

type Row = {
  id_incidencia: number;
  id_personal: number;
  id_falta: number;
  fecha_hora_registro: string;
  id_usuario_registro: number;
  observaciones: string | null;
  estado: EstadoIncidencia;
  motivo_anulacion: string | null;
  personal: { nombre_completo: string; codigo_barras: string; categoria: PersonalCategoria } | null;
  catalogo_faltas: { nombre_falta: string; categoria: string | null; es_grave: boolean } | null;
  usuarios_registro: { nombre_completo: string } | null;
};

const SELECT = `
  id_incidencia, id_personal, id_falta, fecha_hora_registro, id_usuario_registro,
  observaciones, estado, motivo_anulacion,
  personal:id_personal ( nombre_completo, codigo_barras, categoria ),
  catalogo_faltas:id_falta ( nombre_falta, categoria, es_grave ),
  usuarios_registro:id_usuario_registro ( nombre_completo )
`;

const AUTO_PREFIX = 'Generada automáticamente';

function mapRow(row: Row): PersonalIncident {
  return {
    id: row.id_incidencia,
    personalId: row.id_personal,
    personalName: row.personal?.nombre_completo ?? `#${row.id_personal}`,
    personalBarcode: row.personal?.codigo_barras ?? '',
    personalCategory: row.personal?.categoria ?? null,
    faultId: row.id_falta,
    faultName: row.catalogo_faltas?.nombre_falta ?? `Falta #${row.id_falta}`,
    faultCategory: row.catalogo_faltas?.categoria ?? null,
    isSerious: Boolean(row.catalogo_faltas?.es_grave),
    registeredAt: row.fecha_hora_registro,
    registeredById: row.id_usuario_registro,
    registeredByName: row.usuarios_registro?.nombre_completo ?? null,
    observations: row.observaciones,
    status: row.estado,
    resolutionReason: row.motivo_anulacion,
    automatic: (row.observaciones ?? '').startsWith(AUTO_PREFIX),
  };
}

export const personalIncidentsService = {
  async list(filters: {
    from: string;
    to: string;
    personalId?: number;
  }): Promise<{ incidents: PersonalIncident[]; error: string | null }> {
    const desde = getLimaDayRangeISO(filters.from).desde;
    const hasta = getLimaDayRangeISO(filters.to).hasta;
    const all: PersonalIncident[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      let q = supabase
        .from('incidencias_personal')
        .select(SELECT)
        .gte('fecha_hora_registro', desde)
        .lte('fecha_hora_registro', hasta)
        .order('fecha_hora_registro', { ascending: false })
        .range(from, from + pageSize - 1);
      if (filters.personalId) q = q.eq('id_personal', filters.personalId);
      const { data, error } = await q;
      if (error) return { incidents: [], error: error.message };
      const rows = (data ?? []) as unknown as Row[];
      all.push(...rows.map(mapRow));
      if (rows.length < pageSize) break;
    }
    return { incidents: all, error: null };
  },

  async create(input: {
    personalId: number;
    faultId: number;
    userId: number;
    observations?: string;
  }): Promise<{ incident: PersonalIncident | null; error: string | null }> {
    const { data, error } = await supabase
      .from('incidencias_personal')
      .insert({
        id_personal: input.personalId,
        id_falta: input.faultId,
        id_usuario_registro: input.userId,
        observaciones: input.observations?.trim() || null,
      })
      .select(SELECT)
      .single();
    if (error) return { incident: null, error: error.message };
    return { incident: mapRow(data as unknown as Row), error: null };
  },

  /** Justifica (o anula) una incidencia activa con su motivo. */
  async resolve(
    id: number,
    userId: number,
    reason: string,
    estado: 'Justificada' | 'Anulada',
  ): Promise<{ success: boolean; error: string | null }> {
    if (reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH) {
      return { success: false, error: `El motivo debe tener al menos ${MIN_JUSTIFICATION_REASON_LENGTH} caracteres.` };
    }
    const { data, error } = await supabase
      .from('incidencias_personal')
      .update({
        estado,
        motivo_anulacion: reason.trim(),
        id_usuario_anulacion: userId,
        fecha_anulacion: new Date().toISOString(),
      })
      .eq('id_incidencia', id)
      .eq('estado', 'Activa')
      .select('id_incidencia');
    if (error) return { success: false, error: error.message };
    if (!data?.length) return { success: false, error: 'La incidencia ya no está activa.' };
    return { success: true, error: null };
  },
};
