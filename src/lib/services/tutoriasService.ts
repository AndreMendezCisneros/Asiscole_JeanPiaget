import { supabase } from '../supabaseClient';
import { sessionService } from './sessionService';
import type { SalonDisponible, Tutoria } from '@/types/tutorAula';

const SESSION_EXPIRED = 'Sesión expirada. Vuelva a iniciar sesión.';

/** RR.HH.: asignar docentes tutores de aula (usuario DocenteTutor + salón). */
export const tutoriasService = {
  async list(): Promise<{ tutorias: Tutoria[]; salones: SalonDisponible[]; error: string | null }> {
    const token = sessionService.getApiToken();
    if (!token) return { tutorias: [], salones: [], error: SESSION_EXPIRED };
    try {
      const { data, error } = await supabase.rpc('sie_rrhh_tutorias', { p_token: token });
      if (error) return { tutorias: [], salones: [], error: error.message };
      const payload = (data ?? {}) as { tutorias?: unknown; salones?: unknown; error?: string | null };
      if (payload.error) return { tutorias: [], salones: [], error: payload.error };
      return {
        tutorias: Array.isArray(payload.tutorias) ? (payload.tutorias as Tutoria[]) : [],
        salones: Array.isArray(payload.salones) ? (payload.salones as SalonDisponible[]) : [],
        error: null,
      };
    } catch (err: unknown) {
      return { tutorias: [], salones: [], error: err instanceof Error ? err.message : 'Error al cargar tutores' };
    }
  },

  /** Crea o actualiza. `password` vacío al editar = no cambiarla. */
  async save(input: {
    personalId: number;
    username: string;
    password: string;
    level: string;
    grade: string;
    section: string;
    active: boolean;
  }): Promise<{ error: string | null }> {
    const token = sessionService.getApiToken();
    if (!token) return { error: SESSION_EXPIRED };
    try {
      const { data, error } = await supabase.rpc('sie_rrhh_guardar_tutor', {
        p_token: token,
        p_id_personal: input.personalId,
        p_username: input.username.trim(),
        p_password: input.password.trim() || null,
        p_nivel: input.level,
        p_grado: input.grade,
        p_seccion: input.section,
        p_activo: input.active,
      });
      if (error) return { error: error.message };
      const payload = data as { ok?: boolean; error?: string | null } | null;
      if (!payload?.ok) return { error: payload?.error || 'No se pudo guardar el tutor' };
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error al guardar el tutor' };
    }
  },

  async remove(personalId: number): Promise<{ error: string | null }> {
    const token = sessionService.getApiToken();
    if (!token) return { error: SESSION_EXPIRED };
    try {
      const { data, error } = await supabase.rpc('sie_rrhh_quitar_tutor', {
        p_token: token,
        p_id_personal: personalId,
      });
      if (error) return { error: error.message };
      const payload = data as { ok?: boolean; error?: string | null } | null;
      if (!payload?.ok) return { error: payload?.error || 'No se pudo quitar el tutor' };
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Error al quitar el tutor' };
    }
  },
};
