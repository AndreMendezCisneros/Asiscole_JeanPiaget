import { supabase } from '../supabaseClient';
import { IncidentEvidence, EvidenciaFotograficaDB } from '@/types';
import {
  prefetchEvidencePhotoUrls,
  resolveEvidencePhotoUrl,
} from '@/lib/utils/evidencePhoto';
import { compressImageForUpload } from '@/lib/utils/compressImage';

/**
 * Servicio de evidencias fotográficas
 */
export const evidenceService = {
  /**
   * Subir evidencia fotográfica
   */
  async upload(
    incidentId: number,
    file: File,
    userId: number
  ): Promise<{ evidence: IncidentEvidence | null; error: string | null }> {
    try {
      const uploadFile = await compressImageForUpload(file);

      // Normalizar MIME: algunos navegadores pueden reportar 'image/jpg'
      const ext = (uploadFile.name.split('.').pop() || '').toLowerCase();
      const normalizedMime =
        uploadFile.type === 'image/jpg' || (ext === 'jpg' && uploadFile.type === '')
          ? 'image/jpeg'
          : uploadFile.type;

      if (!normalizedMime.match(/^image\/(jpeg|png)$/)) {
        return { evidence: null, error: 'Solo se permiten archivos JPG o PNG' };
      }

      if (uploadFile.size > 5242880) {
        return { evidence: null, error: 'El archivo no puede superar los 5MB' };
      }

      const fileExt = ext || 'jpg';
      const fileName = `${incidentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      const filePath = `${incidentId}/${fileName}`;

      // Subir archivo a Supabase Storage
      // Nota: Necesitas crear un bucket llamado 'evidencias' en Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(filePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: normalizedMime,
        });

      if (uploadError) {
        console.error('Error al subir archivo:', uploadError);
        return { evidence: null, error: 'Error al subir el archivo' };
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('evidencias')
        .getPublicUrl(filePath);

      // Registrar en base de datos usando función almacenada
      const { data, error } = await supabase.rpc('insertar_evidencia', {
        p_id_incidencia: incidentId,
        p_ruta_archivo: filePath,
        p_nombre_original: file.name,
        p_nombre_archivo: fileName,
        p_tamano_bytes: uploadFile.size,
        p_tipo_mime: normalizedMime,
        p_id_usuario_subida: userId
      });


      if (error || data == null) {
        // Si falla, eliminar el archivo subido
        await supabase.storage.from('evidencias').remove([filePath]);
        return { 
          evidence: null, 
          error: error?.message || 'No se pudo registrar la evidencia en la base de datos' 
        };
      }

      const evidenceData = typeof data === 'object' ? (data as Record<string, unknown>) : { id_evidencia: data };

      const evidence: IncidentEvidence = {
        id: Number(evidenceData.id_evidencia),
        incidentId: Number(evidenceData.id_incidencia ?? incidentId),
        filename: String(evidenceData.nombre_original ?? file.name),
        url: urlData.publicUrl,
        uploadedBy: Number(evidenceData.id_usuario_subida ?? userId),
        uploadedAt: String(evidenceData.fecha_subida ?? new Date().toISOString()),
      };

      return { evidence, error: null };
    } catch (error: any) {
      console.error('Error en upload:', error);
      return { evidence: null, error: error.message || 'Error al subir evidencia' };
    }
  },

  /**
   * Obtener evidencias de una incidencia
   */
  async getByIncident(incidentId: number): Promise<{ evidences: IncidentEvidence[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('evidencias_fotograficas')
        .select('*')
        .eq('id_incidencia', incidentId)
        .order('fecha_subida', { ascending: false });

      if (error) {
        return { evidences: [], error: error.message };
      }

      const rows = data ?? [];
      await prefetchEvidencePhotoUrls(rows.map((ev) => ev.ruta_archivo));

      const evidences: IncidentEvidence[] = await Promise.all(
        rows.map(async (ev: EvidenciaFotograficaDB) => ({
          id: ev.id_evidencia,
          incidentId: ev.id_incidencia,
          filename: ev.nombre_original,
          url: await resolveEvidencePhotoUrl(ev.ruta_archivo),
          uploadedBy: ev.id_usuario_subida,
          uploadedAt: ev.fecha_subida,
        })),
      );

      return { evidences, error: null };
    } catch (error: any) {
      console.error('Error en getByIncident:', error);
      return { evidences: [], error: error.message || 'Error al obtener evidencias' };
    }
  },

  /**
   * Eliminar evidencia
   */
  async delete(evidenceId: number): Promise<{ success: boolean; error: string | null }> {
    try {
      // Obtener información de la evidencia
      const { data: evidence, error: fetchError } = await supabase
        .from('evidencias_fotograficas')
        .select('ruta_archivo')
        .eq('id_evidencia', evidenceId)
        .single();

      if (fetchError || !evidence) {
        return { success: false, error: 'Evidencia no encontrada' };
      }

      // Eliminar de base de datos (el trigger eliminará automáticamente cantidad_fotos)
      const { error: deleteError } = await supabase
        .from('evidencias_fotograficas')
        .delete()
        .eq('id_evidencia', evidenceId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // Eliminar archivo del storage
      await supabase.storage.from('evidencias').remove([evidence.ruta_archivo]);

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en delete:', error);
      return { success: false, error: error.message || 'Error al eliminar evidencia' };
    }
  },
};
