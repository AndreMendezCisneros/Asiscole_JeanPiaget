import { supabase } from '../supabaseClient';
import type { EducationalLevel, Taller, TallerInscrito } from '@/types';
import { setTallerSchemaAvailable } from './incidentSelect';

type TallerRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  dia_semana: number[] | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type TallerInscritoRow = {
  id: string;
  taller_id: string;
  id_estudiante: number;
  activo: boolean;
  estudiante?: {
    id_estudiante: number;
    nombre_completo: string;
    grado: string;
    seccion: string;
    nivel_educativo: string;
    codigo_barras: string;
    foto_perfil?: string | null;
    activo: boolean;
  } | null;
};

function truncateTimeHHmm(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 5 ? trimmed.substring(0, 5) : trimmed;
}

export function mapTallerRow(row: TallerRow): Taller {
  return {
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    diaSemana: row.dia_semana,
    horaInicio: truncateTimeHHmm(row.hora_inicio),
    horaFin: truncateTimeHHmm(row.hora_fin),
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInscritoRow(row: TallerInscritoRow): TallerInscrito {
  return {
    id: row.id,
    tallerId: row.taller_id,
    studentId: row.id_estudiante,
    activo: row.activo,
    student: row.estudiante
      ? {
          id: row.estudiante.id_estudiante,
          fullName: row.estudiante.nombre_completo,
          grade: row.estudiante.grado,
          section: row.estudiante.seccion,
          level: (row.estudiante.nivel_educativo || 'Secundaria') as EducationalLevel,
          barcode: row.estudiante.codigo_barras,
          profilePhoto: row.estudiante.foto_perfil ?? null,
          active: row.estudiante.activo,
          reincidenceLevel: 0,
          faultsLast60Days: 0,
        }
      : undefined,
  };
}

const INSCRITO_STUDENT_SELECT = `
  id,
  taller_id,
  id_estudiante,
  activo,
  estudiante:estudiantes!taller_inscritos_id_estudiante_fkey(
    id_estudiante,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    codigo_barras,
    foto_perfil,
    activo
  )
`;

export const talleresService = {
  async listActive(): Promise<{ talleres: Taller[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('talleres')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        setTallerSchemaAvailable(false);
        return { talleres: [], error: error.message };
      }

      setTallerSchemaAvailable(true);
      return { talleres: (data || []).map(mapTallerRow), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al listar talleres activos';
      console.error('Error en listActive:', error);
      setTallerSchemaAvailable(false);
      return { talleres: [], error: message };
    }
  },

  async listAll(): Promise<{ talleres: Taller[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('talleres')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        setTallerSchemaAvailable(false);
        return { talleres: [], error: error.message };
      }

      setTallerSchemaAvailable(true);
      return { talleres: (data || []).map(mapTallerRow), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al listar talleres';
      console.error('Error en listAll:', error);
      setTallerSchemaAvailable(false);
      return { talleres: [], error: message };
    }
  },

  async create(input: {
    nombre: string;
    descripcion?: string | null;
    diaSemana?: number[] | null;
    horaInicio?: string | null;
    horaFin?: string | null;
  }): Promise<{ taller: Taller | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('talleres')
        .insert({
          nombre: input.nombre,
          descripcion: input.descripcion ?? null,
          dia_semana: input.diaSemana ?? null,
          hora_inicio: input.horaInicio ?? null,
          hora_fin: input.horaFin ?? null,
          activo: true,
        })
        .select('*')
        .single();

      if (error) {
        return { taller: null, error: error.message };
      }

      return { taller: mapTallerRow(data as TallerRow), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al crear taller';
      console.error('Error en create:', error);
      return { taller: null, error: message };
    }
  },

  async update(
    id: string,
    updates: Partial<{
      nombre: string;
      descripcion: string | null;
      diaSemana: number[] | null;
      horaInicio: string | null;
      horaFin: string | null;
    }>,
  ): Promise<{ taller: Taller | null; error: string | null }> {
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.nombre !== undefined) payload.nombre = updates.nombre;
      if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion;
      if (updates.diaSemana !== undefined) payload.dia_semana = updates.diaSemana;
      if (updates.horaInicio !== undefined) payload.hora_inicio = updates.horaInicio;
      if (updates.horaFin !== undefined) payload.hora_fin = updates.horaFin;

      const { data, error } = await supabase
        .from('talleres')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return { taller: null, error: error.message };
      }

      return { taller: mapTallerRow(data as TallerRow), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al actualizar taller';
      console.error('Error en update:', error);
      return { taller: null, error: message };
    }
  },

  async setActivo(id: string, activo: boolean): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('talleres')
        .update({
          activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cambiar estado del taller';
      console.error('Error en setActivo:', error);
      return { success: false, error: message };
    }
  },

  async listInscritos(tallerId: string): Promise<{ inscritos: TallerInscrito[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('taller_inscritos')
        .select(INSCRITO_STUDENT_SELECT)
        .eq('taller_id', tallerId)
        .eq('activo', true)
        .order('id_estudiante', { ascending: true });

      if (error) {
        return { inscritos: [], error: error.message };
      }

      return {
        inscritos: (data || []).map((row) => mapInscritoRow(row as TallerInscritoRow)),
        error: null,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al listar inscritos';
      console.error('Error en listInscritos:', error);
      return { inscritos: [], error: message };
    }
  },

  async addInscrito(
    tallerId: string,
    studentId: number,
  ): Promise<{ inscrito: TallerInscrito | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('taller_inscritos')
        .upsert(
          {
            taller_id: tallerId,
            id_estudiante: studentId,
            activo: true,
          },
          { onConflict: 'taller_id,id_estudiante' },
        )
        .select(INSCRITO_STUDENT_SELECT)
        .single();

      if (error) {
        return { inscrito: null, error: error.message };
      }

      return { inscrito: mapInscritoRow(data as TallerInscritoRow), error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al inscribir alumno';
      console.error('Error en addInscrito:', error);
      return { inscrito: null, error: message };
    }
  },

  async removeInscrito(
    tallerId: string,
    studentId: number,
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('taller_inscritos')
        .update({ activo: false })
        .eq('taller_id', tallerId)
        .eq('id_estudiante', studentId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al quitar inscripción';
      console.error('Error en removeInscrito:', error);
      return { success: false, error: message };
    }
  },

  async isStudentInscrito(
    tallerId: string,
    studentId: number,
  ): Promise<{ inscrito: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('taller_inscritos')
        .select('id')
        .eq('taller_id', tallerId)
        .eq('id_estudiante', studentId)
        .eq('activo', true)
        .maybeSingle();

      if (error) {
        return { inscrito: false, error: error.message };
      }

      return { inscrito: !!data, error: null };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al verificar inscripción';
      console.error('Error en isStudentInscrito:', error);
      return { inscrito: false, error: message };
    }
  },
};
