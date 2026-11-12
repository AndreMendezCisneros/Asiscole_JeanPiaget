import { supabase } from '../supabaseClient';
import { getLimaDayRangeISO } from '@/lib/utils/limaDateTime';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { compressImageForUpload } from '@/lib/utils/compressImage';
import {
  prefetchEvidencePhotoUrls,
  resolveEvidencePhotoUrl,
} from '@/lib/utils/evidencePhoto';
import type { EstadoIncidencia, IncidentEvidence } from '@/types';
import type { PersonalCategoria } from '@/types/personal';

const EVIDENCE_BUCKET = 'evidencias';
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

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
  registrado_por_nombre: string | null;
  personal: { nombre_completo: string; codigo_barras: string; categoria: PersonalCategoria } | null;
  catalogo_faltas: { nombre_falta: string; categoria: string | null; es_grave: boolean } | null;
  usuarios_registro: { nombre_completo: string } | null;
};

const SELECT = `
  id_incidencia, id_personal, id_falta, fecha_hora_registro, id_usuario_registro,
  observaciones, estado, motivo_anulacion, registrado_por_nombre,
  personal:id_personal ( nombre_completo, codigo_barras, categoria ),
  catalogo_faltas:id_falta ( nombre_falta, categoria, es_grave ),
  usuarios_registro:id_usuario_registro ( nombre_completo )
`;

const AUTO_PREFIX = 'Generada automáticamente';

/**
 * Quién registró la incidencia. RRHH no puede leer la tabla usuarios (RLS), por
 * eso se usa primero el nombre guardado al insertar (registrado_por_nombre).
 */
export function resolveRegisteredByName(
  row: Pick<Row, 'registrado_por_nombre' | 'usuarios_registro' | 'observaciones'>,
): string | null {
  const saved = row.registrado_por_nombre?.trim();
  if (saved) return saved;
  const joined = row.usuarios_registro?.nombre_completo?.trim();
  if (joined) return joined;
  if ((row.observaciones ?? '').startsWith(AUTO_PREFIX)) return 'Sistema (automática)';
  return null;
}

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
    registeredByName: resolveRegisteredByName(row),
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
  }): Promise<{ id: number | null; error: string | null }> {
    const { data, error } = await supabase.rpc('sie_incidencia_personal_crear', {
      p_id_personal: input.personalId,
      p_id_falta: input.faultId,
      p_id_usuario_registro: input.userId,
      p_observaciones: input.observations?.trim() || null,
    });
    if (error) return { id: null, error: error.message };
    const payload = (typeof data === 'string' ? JSON.parse(data) : data) as { id_incidencia?: number } | null;
    const id = Number(payload?.id_incidencia);
    if (!Number.isFinite(id) || id <= 0) return { id: null, error: 'No se obtuvo el número de la incidencia' };
    return { id, error: null };
  },

  async listEvidences(incidentId: number): Promise<{ evidences: IncidentEvidence[]; error: string | null }> {
    const { data, error } = await supabase
      .from('evidencias_fotograficas_personal')
      .select('id_evidencia, id_incidencia, ruta_archivo, nombre_original, id_usuario_subida, fecha_subida')
      .eq('id_incidencia', incidentId)
      .order('fecha_subida', { ascending: true });
    if (error) return { evidences: [], error: error.message };
    const rows = data ?? [];
    await prefetchEvidencePhotoUrls(rows.map((ev) => ev.ruta_archivo));
    const evidences: IncidentEvidence[] = await Promise.all(
      rows.map(async (ev) => ({
        id: ev.id_evidencia,
        incidentId: ev.id_incidencia,
        filename: ev.nombre_original,
        url: await resolveEvidencePhotoUrl(ev.ruta_archivo),
        uploadedBy: ev.id_usuario_subida ?? 0,
        uploadedAt: ev.fecha_subida,
      })),
    );
    return { evidences, error: null };
  },

  async uploadEvidence(
    incidentId: number,
    file: File,
    userId: number,
  ): Promise<{ evidence: IncidentEvidence | null; error: string | null }> {
    const uploadFile = await compressImageForUpload(file);
    const ext = (uploadFile.name.split('.').pop() || '').toLowerCase();
    const mime =
      uploadFile.type === 'image/jpg' || (ext === 'jpg' && uploadFile.type === '')
        ? 'image/jpeg'
        : uploadFile.type;
    if (!mime.match(/^image\/(jpeg|png)$/)) {
      return { evidence: null, error: 'Solo se permiten archivos JPG o PNG' };
    }
    if (uploadFile.size > MAX_EVIDENCE_BYTES) {
      return { evidence: null, error: 'El archivo no puede superar los 5MB' };
    }
    const fileExt = ext === 'png' ? 'png' : 'jpg';
    const fileName = `${incidentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `personal-incidencias/${incidentId}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(filePath, uploadFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: mime,
    });
    if (uploadError) return { evidence: null, error: 'Error al subir el archivo' };

    const { data: urlData } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(filePath);
    const { data, error } = await supabase.rpc('sie_insertar_evidencia_personal', {
      p_id_incidencia: incidentId,
      p_ruta_archivo: filePath,
      p_nombre_original: file.name,
      p_nombre_archivo: fileName,
      p_tamano_bytes: uploadFile.size,
      p_tipo_mime: mime,
      p_id_usuario_subida: userId,
    });
    if (error || data == null) {
      await supabase.storage.from(EVIDENCE_BUCKET).remove([filePath]);
      return { evidence: null, error: error?.message || 'No se pudo registrar la evidencia' };
    }
    const row = data as Record<string, unknown>;
    return {
      evidence: {
        id: Number(row.id_evidencia),
        incidentId: Number(row.id_incidencia ?? incidentId),
        filename: String(row.nombre_original ?? file.name),
        url: urlData.publicUrl,
        uploadedBy: Number(row.id_usuario_subida ?? userId),
        uploadedAt: String(row.fecha_subida ?? new Date().toISOString()),
      },
      error: null,
    };
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
