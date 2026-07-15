import { supabase } from '../supabaseClient';
import type { DocenteClassroom } from '@/types';
import { sessionService } from './sessionService';

export interface TeacherAccount {
  id: number;
  username: string;
  fullName: string;
  email: string;
  active: boolean;
  classrooms: DocenteClassroom[];
  lastAccess?: string | null;
  createdAt?: string | null;
}

function requireApiToken(): string | null {
  return sessionService.getApiToken();
}

function mapTeacher(raw: Record<string, unknown>): TeacherAccount {
  const classrooms = Array.isArray(raw.classrooms)
    ? (raw.classrooms as DocenteClassroom[])
    : [];
  return {
    id: Number(raw.id),
    username: String(raw.username ?? ''),
    fullName: String(raw.fullName ?? ''),
    email: String(raw.email ?? ''),
    active: raw.active !== false,
    classrooms,
    lastAccess: (raw.lastAccess as string | null) ?? null,
    createdAt: (raw.createdAt as string | null) ?? null,
  };
}

export const teachersService = {
  async list(): Promise<{ teachers: TeacherAccount[]; error: string | null }> {
    const token = requireApiToken();
    if (!token) {
      return { teachers: [], error: 'Sesión expirada. Vuelva a iniciar sesión.' };
    }

    try {
      const { data, error } = await supabase.rpc('sie_admin_listar_docentes', { p_token: token });
      if (error) return { teachers: [], error: error.message };

      const payload = data as { teachers?: unknown; error?: string | null };
      if (payload?.error) return { teachers: [], error: payload.error };

      const rows = Array.isArray(payload?.teachers) ? payload.teachers : [];
      return {
        teachers: rows.map((row) => mapTeacher(row as Record<string, unknown>)),
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al listar docentes';
      return { teachers: [], error: message };
    }
  },

  async create(input: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    classrooms: DocenteClassroom[];
  }): Promise<{ id: number | null; error: string | null }> {
    const token = requireApiToken();
    if (!token) return { id: null, error: 'Sesión expirada. Vuelva a iniciar sesión.' };

    try {
      const { data, error } = await supabase.rpc('sie_admin_crear_docente', {
        p_token: token,
        p_username: input.username.trim(),
        p_password: input.password,
        p_full_name: input.fullName.trim(),
        p_email: input.email.trim(),
        p_classrooms: input.classrooms,
      });

      if (error) return { id: null, error: error.message };

      const payload = data as { ok?: boolean; id?: number; error?: string | null };
      if (!payload?.ok) return { id: null, error: payload?.error || 'No se pudo crear el docente' };
      return { id: payload.id ?? null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear docente';
      return { id: null, error: message };
    }
  },

  async update(input: {
    id: number;
    fullName: string;
    email: string;
    classrooms: DocenteClassroom[];
    active: boolean;
    password?: string;
  }): Promise<{ error: string | null }> {
    const token = requireApiToken();
    if (!token) return { error: 'Sesión expirada. Vuelva a iniciar sesión.' };

    try {
      const { data, error } = await supabase.rpc('sie_admin_actualizar_docente', {
        p_token: token,
        p_id: input.id,
        p_full_name: input.fullName.trim(),
        p_email: input.email.trim(),
        p_classrooms: input.classrooms,
        p_active: input.active,
        p_password: input.password?.trim() || null,
      });

      if (error) return { error: error.message };

      const payload = data as { ok?: boolean; error?: string | null };
      if (!payload?.ok) return { error: payload?.error || 'No se pudo actualizar el docente' };
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar docente';
      return { error: message };
    }
  },
};
