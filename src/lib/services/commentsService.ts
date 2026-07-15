import { supabase } from '../supabaseClient';
import { Comment, ComentarioIncidenciaDB } from '@/types';

/**
 * Servicio de comentarios de incidencias
 */
export const commentsService = {
  /**
   * Obtener comentarios de una incidencia
   */
  async getByIncident(incidentId: number): Promise<{ comments: Comment[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('comentarios_incidencias')
        .select(`
          *,
          usuarios:id_usuario (
            id_usuario,
            username,
            nombre_completo,
            email,
            rol,
            activo
          )
        `)
        .eq('id_incidencia', incidentId)
        .order('fecha_hora', { ascending: false });

      if (error) {
        return { comments: [], error: error.message };
      }

      const comments: Comment[] = (data || []).map((com: any) => {
        const usuario = com.usuarios || com.id_usuario;
        return {
          id: com.id_comentario,
          incidentId: com.id_incidencia,
          userId: com.id_usuario,
          user: usuario && typeof usuario === 'object' ? {
            id: usuario.id_usuario,
            username: usuario.username,
            fullName: usuario.nombre_completo,
            email: usuario.email,
            role: usuario.rol,
            active: usuario.activo,
          } : undefined,
          content: com.texto_comentario,
          createdAt: com.fecha_hora,
        };
      });

      return { comments, error: null };
    } catch (error: any) {
      console.error('Error en getByIncident:', error);
      return { comments: [], error: error.message || 'Error al obtener comentarios' };
    }
  },

  /**
   * Crear comentario
   */
  async create(
    incidentId: number,
    userId: number,
    content: string
  ): Promise<{ comment: Comment | null; error: string | null }> {
    try {
      if (!content || content.trim().length === 0) {
        return { comment: null, error: 'El comentario no puede estar vacío' };
      }

      if (content.length > 500) {
        return { comment: null, error: 'El comentario no puede exceder 500 caracteres' };
      }

      const { data, error } = await supabase
        .from('comentarios_incidencias')
        .insert({
          id_incidencia: incidentId,
          id_usuario: userId,
          texto_comentario: content.trim(),
          fecha_hora: new Date().toISOString(),
        })
        .select(`
          *,
          usuarios:id_usuario (
            id_usuario,
            username,
            nombre_completo,
            email,
            rol,
            activo
          )
        `)
        .single();

      if (error) {
        return { comment: null, error: error.message };
      }

      const usuario = data.usuarios || data.id_usuario;
      const comment: Comment = {
        id: data.id_comentario,
        incidentId: data.id_incidencia,
        userId: data.id_usuario,
        user: usuario && typeof usuario === 'object' ? {
          id: usuario.id_usuario,
          username: usuario.username,
          fullName: usuario.nombre_completo,
          email: usuario.email,
          role: usuario.rol,
          active: usuario.activo,
        } : undefined,
        content: data.texto_comentario,
        createdAt: data.fecha_hora,
      };

      return { comment, error: null };
    } catch (error: any) {
      console.error('Error en create:', error);
      return { comment: null, error: error.message || 'Error al crear comentario' };
    }
  },

  /**
   * Eliminar comentario
   */
  async delete(commentId: number, userId: number): Promise<{ success: boolean; error: string | null }> {
    try {
      // Verificar que el comentario pertenezca al usuario (o sea admin/director)
      const { data: comment, error: fetchError } = await supabase
        .from('comentarios_incidencias')
        .select('id_usuario')
        .eq('id_comentario', commentId)
        .single();

      if (fetchError || !comment) {
        return { success: false, error: 'Comentario no encontrado' };
      }

      // TODO: Verificar permisos (admin/director pueden eliminar cualquier comentario)
      // Por ahora, solo el autor puede eliminar
      if (comment.id_usuario !== userId) {
        return { success: false, error: 'No tienes permiso para eliminar este comentario' };
      }

      const { error: deleteError } = await supabase
        .from('comentarios_incidencias')
        .delete()
        .eq('id_comentario', commentId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en delete:', error);
      return { success: false, error: error.message || 'Error al eliminar comentario' };
    }
  },
};
