import { supabase } from '../supabaseClient';
import { ParentMeeting, CitaPadreDB } from '@/types';
import { getLimaNow, getLimaTodayDate, normalizeTimeHHMM } from '@/lib/utils/limaDateTime';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import { studentsService } from './studentsService';
import { fetchAllPages } from '@/lib/utils/supabasePagination';

const INSERT_BATCH_SIZE = 200;

const PARENT_MEETING_RELATIONS = `
  estudiante:estudiantes!citas_padres_id_estudiante_fkey (
    id_estudiante,
    nombre_completo,
    grado,
    seccion,
    nivel_educativo,
    codigo_barras
  ),
  usuario_creador:usuarios!citas_padres_id_usuario_creador_fkey (
    id_usuario,
    nombre_completo
  )
`;

const PARENT_MEETING_BASE_COLUMNS = [
  'id_cita',
  'id_estudiante',
  'id_usuario_creador',
  'motivo',
  'fecha',
  'hora',
  'estado',
  'asistencia',
  'notas',
  'fecha_creacion',
  'fecha_actualizacion',
] as const;

const PARENT_MEETING_LATE_COLUMNS = ['llegada_tarde', 'hora_llegada_real'] as const;

/** null = sin probar; true/false según si existen en la BD (migración PATCH_CITAS_LLEGADA_TARDE). */
let lateColumnsSupported: boolean | null = null;

function buildParentMeetingListSelect(includeLate: boolean): string {
  const cols = [
    ...PARENT_MEETING_BASE_COLUMNS,
    ...(includeLate ? PARENT_MEETING_LATE_COLUMNS : []),
  ];
  return `${cols.join(',\n  ')},\n  ${PARENT_MEETING_RELATIONS.trim()}`;
}

function isMissingColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('no existe')))
  );
}

async function updateCitaRow(
  id: number,
  data: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const hasLateFields = 'llegada_tarde' in data || 'hora_llegada_real' in data;

  const run = async (payload: Record<string, unknown>) => {
    const { error } = await supabase.from('citas_padres').update(payload).eq('id_cita', id);
    return error;
  };

  let error = await run(data);
  if (error && hasLateFields && isMissingColumnError(error)) {
    lateColumnsSupported = false;
    const { llegada_tarde: _lt, hora_llegada_real: _hl, ...rest } = data;
    error = await run(rest);
  } else if (!error && hasLateFields) {
    lateColumnsSupported = true;
  }

  return { error: error?.message ?? null };
}

/**
 * Servicio para gestionar citas con padres
 */

/**
 * Mapear cita de DB a formato frontend
 */
function mapDBToParentMeeting(data: CitaPadreDB & {
  estudiante?: any;
  usuario_creador?: any;
}): ParentMeeting {
  return {
    id: data.id_cita,
    studentId: data.id_estudiante,
    student: data.estudiante ? {
      id: data.estudiante.id_estudiante,
      fullName: data.estudiante.nombre_completo,
      grade: data.estudiante.grado,
      section: data.estudiante.seccion,
      level: data.estudiante.nivel_educativo,
      barcode: data.estudiante.codigo_barras,
      profilePhoto: data.estudiante.foto_perfil,
      active: data.estudiante.activo,
    } : undefined,
    motivo: data.motivo,
    fecha: data.fecha,
    hora: data.hora,
    estado: data.estado,
    asistencia: data.asistencia,
    llegadaTarde: (data as any).llegada_tarde ?? null,
    horaLlegadaReal: (data as any).hora_llegada_real ?? null,
    notas: data.notas,
    createdBy: data.id_usuario_creador,
    createdByUser: data.usuario_creador ? {
      id: data.usuario_creador.id_usuario,
      username: data.usuario_creador.username,
      fullName: data.usuario_creador.nombre_completo,
      email: data.usuario_creador.email,
      role: data.usuario_creador.rol,
      active: data.usuario_creador.activo,
    } : undefined,
    createdAt: data.fecha_creacion,
    updatedAt: data.fecha_actualizacion,
  };
}

export const parentMeetingsService = {
  /**
   * Crear nueva cita con padre
   */
  async create(meeting: {
    id_estudiante: number;
    motivo: string;
    fecha: string; // YYYY-MM-DD
    hora: string; // HH:MM
    id_usuario_creador: number;
    notas?: string;
  }): Promise<{ meeting: ParentMeeting | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('citas_padres')
        .insert({
          id_estudiante: meeting.id_estudiante,
          motivo: meeting.motivo,
          fecha: meeting.fecha,
          hora: meeting.hora,
          id_usuario_creador: meeting.id_usuario_creador,
          estado: 'Pendiente',
          notas: meeting.notas || null,
          asistencia: null,
        })
        .select()
        .single();

      if (error) {
        return { meeting: null, error: error.message };
      }

      // Obtener la cita completa con relaciones
      return await this.getById(data.id_cita);
    } catch (error: any) {
      console.error('Error en create:', error);
      return { meeting: null, error: error.message || 'Error al crear cita' };
    }
  },

  /**
   * Crear citas masivas
   */
  async createBulk(meetings: {
    motivo: string;
    fecha: string; // YYYY-MM-DD
    hora: string; // HH:MM
    id_usuario_creador: number;
    notas?: string;
    tipo: 'all' | 'grade' | 'section' | 'students';
    grade?: string;
    section?: string;
    level?: string;
    studentIds?: number[];
  }): Promise<{ success: boolean; count: number; error: string | null }> {
    try {
      const studentIdsResult = await fetchActiveStudentIdsForBulk(meetings);
      if (studentIdsResult.error) {
        return { success: false, count: 0, error: studentIdsResult.error };
      }

      const studentIds = studentIdsResult.ids;
      if (studentIds.length === 0) {
        return { success: false, count: 0, error: 'No se encontraron estudiantes para crear las citas' };
      }

      const citas = studentIds.map((id_estudiante) => ({
        id_estudiante,
        motivo: meetings.motivo,
        fecha: meetings.fecha,
        hora: meetings.hora,
        id_usuario_creador: meetings.id_usuario_creador,
        estado: 'Pendiente' as const,
        notas: meetings.notas || null,
        asistencia: null,
      }));

      let inserted = 0;
      for (let i = 0; i < citas.length; i += INSERT_BATCH_SIZE) {
        const batch = citas.slice(i, i + INSERT_BATCH_SIZE);
        const { error } = await supabase.from('citas_padres').insert(batch);
        if (error) {
          const partial =
            inserted > 0
              ? ` Se crearon ${inserted} citas antes del error.`
              : '';
          return {
            success: false,
            count: inserted,
            error: `${error.message}${partial}`,
          };
        }
        inserted += batch.length;
      }

      return { success: true, count: inserted, error: null };
    } catch (error: any) {
      console.error('Error en createBulk:', error);
      return { success: false, count: 0, error: error.message || 'Error al crear citas masivas' };
    }
  },

  /**
   * Obtener cita por ID
   */
  async getById(id: number): Promise<{ meeting: ParentMeeting | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('citas_padres')
        .select(`
          *,
          estudiante:estudiantes!citas_padres_id_estudiante_fkey(*),
          usuario_creador:usuarios!citas_padres_id_usuario_creador_fkey(*)
        `)
        .eq('id_cita', id)
        .single();

      if (error || !data) {
        return { meeting: null, error: 'Cita no encontrada' };
      }

      const meeting = mapDBToParentMeeting(data as any);
      return { meeting, error: null };
    } catch (error: any) {
      console.error('Error en getById:', error);
      return { meeting: null, error: error.message || 'Error al obtener cita' };
    }
  },

  /**
   * Obtener todas las citas con filtros
   */
  async getAll(filters?: {
    estudianteId?: number;
    estado?: 'Pendiente' | 'Confirmada' | 'Reprogramada' | 'Completada' | 'No asistió' | 'Cancelada';
    fechaDesde?: string;
    fechaHasta?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ meetings: ParentMeeting[]; total: number; error: string | null }> {
    try {
      const buildQuery = (select: string) => {
        let query = supabase
          .from('citas_padres')
          .select(
            select,
            filters?.limit !== undefined || filters?.offset !== undefined
              ? { count: 'exact' }
              : undefined,
          )
          .order('fecha', { ascending: false })
          .order('hora', { ascending: false });

        if (filters?.estudianteId) {
          query = query.eq('id_estudiante', filters.estudianteId);
        }
        if (filters?.estado) {
          query = query.eq('estado', filters.estado);
        }
        if (filters?.fechaDesde) {
          query = query.gte('fecha', filters.fechaDesde);
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha', filters.fechaHasta);
        }
        return query;
      };

      const tryWithLate = lateColumnsSupported !== false;
      let select = buildParentMeetingListSelect(tryWithLate);

      const runPaged = async () => {
        const offset = filters?.offset ?? 0;
        const limit = filters?.limit ?? 10;
        return buildQuery(select).range(offset, offset + limit - 1);
      };

      const runAll = async () =>
        fetchAllPages((from, to) => buildQuery(select).range(from, to));

      const isPaged = filters?.limit !== undefined || filters?.offset !== undefined;
      let result = isPaged ? await runPaged() : await runAll();

      if (
        result.error &&
        tryWithLate &&
        isMissingColumnError(
          typeof result.error === 'string' ? { message: result.error } : result.error,
        )
      ) {
        lateColumnsSupported = false;
        select = buildParentMeetingListSelect(false);
        result = isPaged ? await runPaged() : await runAll();
      } else if (!result.error && tryWithLate) {
        lateColumnsSupported = true;
      }

      if (result.error) {
        const message =
          typeof result.error === 'string' ? result.error : (result.error as { message: string }).message;
        return { meetings: [], total: 0, error: message };
      }

      const data = isPaged ? (result as { data: any[]; count: number | null }).data : result.data;
      const meetings = (data || []).map((item: any) => mapDBToParentMeeting(item));
      const total = isPaged
        ? ((result as { count: number | null }).count ?? meetings.length)
        : meetings.length;
      return { meetings, total, error: null };
    } catch (error: any) {
      console.error('Error en getAll:', error);
      return { meetings: [], total: 0, error: error.message || 'Error al obtener citas' };
    }
  },

  /**
   * Actualizar cita
   */
  async update(
    id: number,
    updates: Partial<{
      motivo: string;
      fecha: string;
      hora: string;
      estado: 'Pendiente' | 'Confirmada' | 'Reprogramada' | 'Completada' | 'No asistió' | 'Cancelada';
      asistencia: boolean;
      notas: string;
    }>
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('citas_padres')
        .update({
          ...updates,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id_cita', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en update:', error);
      return { success: false, error: error.message || 'Error al actualizar cita' };
    }
  },

  /**
   * Registrar asistencia a cita por código de barras
   */
  async markAttendanceByBarcode(
    barcode: string,
    llegadaTarde: boolean = false,
    fechaCita?: string,
  ): Promise<{ success: boolean; meetingId: number | null; error: string | null }> {
    try {
      const { student, error: studentLookupError } = await studentsService.lookupByBarcodeOrDni(
        barcode,
        { skipReincidence: true },
      );

      if (studentLookupError || !student) {
        return {
          success: false,
          meetingId: null,
          error: studentLookupError || 'Estudiante no encontrado con ese DNI o código',
        };
      }

      const today = getLimaTodayDate();
      const targetDates = [...new Set([fechaCita?.trim().slice(0, 10), today].filter(Boolean))];

      let meeting: { id_cita: number; hora: string; fecha: string } | null = null;

      for (const fecha of targetDates) {
        const { data: meetings, error: meetingsError } = await supabase
          .from('citas_padres')
          .select('id_cita, hora, fecha')
          .eq('id_estudiante', student.id)
          .eq('fecha', fecha)
          .in('estado', ['Pendiente', 'Confirmada'])
          .or('asistencia.is.null,asistencia.eq.false')
          .order('hora', { ascending: true })
          .limit(1);

        if (meetingsError) {
          return { success: false, meetingId: null, error: meetingsError.message };
        }
        if (meetings?.length) {
          meeting = meetings[0];
          break;
        }
      }

      if (!meeting) {
        const { data: proxima } = await supabase
          .from('citas_padres')
          .select('fecha, hora, estado')
          .eq('id_estudiante', student.id)
          .in('estado', ['Pendiente', 'Confirmada'])
          .or('asistencia.is.null,asistencia.eq.false')
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true })
          .limit(1);

        if (proxima?.length) {
          const p = proxima[0];
          return {
            success: false,
            meetingId: null,
            error: `${student.fullName} tiene cita el ${p.fecha} a las ${normalizeTimeHHMM(p.hora)} (${p.estado}), no en la fecha seleccionada. Ajuste el calendario al día del evento.`,
          };
        }

        return {
          success: false,
          meetingId: null,
          error: `No hay cita pendiente para ${student.fullName} en la fecha seleccionada`,
        };
      }

      const horaActual = getLimaNow().time;
      const horaCita = normalizeTimeHHMM(meeting.hora);
      
      // Determinar si llegó tarde comparando horas
      const [horaActualH, horaActualM] = horaActual.split(':').map(Number);
      const [horaCitaH, horaCitaM] = horaCita.split(':').map(Number);
      const minutosActual = horaActualH * 60 + horaActualM;
      const minutosCita = horaCitaH * 60 + horaCitaM;
      const esTarde = minutosActual > minutosCita + 5; // 5 minutos de tolerancia

      const updateData: any = {
        asistencia: true,
        estado: 'Completada',
        llegada_tarde: llegadaTarde || esTarde,
        hora_llegada_real: horaActual,
        fecha_actualizacion: new Date().toISOString(),
      };

      const { error } = await updateCitaRow(meeting.id_cita, updateData);

      if (error) {
        return { success: false, meetingId: null, error };
      }

      return { success: true, meetingId: meeting.id_cita, error: null };
    } catch (error: any) {
      console.error('Error en markAttendanceByBarcode:', error);
      return { success: false, meetingId: null, error: error.message || 'Error al registrar asistencia' };
    }
  },

  /**
   * Registrar asistencia a cita
   */
  async markAttendance(
    id: number,
    asistio: boolean,
    llegadaTarde?: boolean,
    notas?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const estado = asistio ? 'Completada' : 'No asistió';
      
      const updateData: any = {
        asistencia: asistio,
        estado,
        fecha_actualizacion: new Date().toISOString(),
      };

      if (asistio) {
        updateData.hora_llegada_real = getLimaNow().time;
        if (llegadaTarde !== undefined) {
          updateData.llegada_tarde = llegadaTarde;
        }
      }

      if (notas) {
        updateData.notas = notas;
      }

      const { error } = await updateCitaRow(id, updateData);

      if (error) {
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en markAttendance:', error);
      return { success: false, error: error.message || 'Error al registrar asistencia' };
    }
  },

  /**
   * Cancelar cita
   */
  async cancel(id: number, motivo?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: any = {
        estado: 'Cancelada',
        fecha_actualizacion: new Date().toISOString(),
      };

      if (motivo) {
        updateData.notas = motivo;
      }

      const { error } = await supabase
        .from('citas_padres')
        .update(updateData)
        .eq('id_cita', id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error en cancel:', error);
      return { success: false, error: error.message || 'Error al cancelar cita' };
    }
  },

  /**
   * Obtener estadísticas de citas
   */
  async getStats(filters?: {
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<{
    stats: {
      total: number;
      pendientes: number;
      confirmadas: number;
      completadas: number;
      noAsistieron: number;
      tasaAsistencia: number;
    } | null;
    error: string | null;
  }> {
    try {
      const countByEstado = async (
        estado?: 'Pendiente' | 'Confirmada' | 'Completada' | 'No asistió'
      ) => {
        let query = supabase
          .from('citas_padres')
          .select('*', { count: 'exact', head: true });

        if (estado) {
          query = query.eq('estado', estado);
        }
        if (filters?.fechaDesde) {
          query = query.gte('fecha', filters.fechaDesde);
        }
        if (filters?.fechaHasta) {
          query = query.lte('fecha', filters.fechaHasta);
        }

        const { count, error } = await query;
        if (error) {
          throw new Error(error.message);
        }
        return count ?? 0;
      };

      const [total, pendientes, confirmadas, completadas, noAsistieron] = await Promise.all([
        countByEstado(),
        countByEstado('Pendiente'),
        countByEstado('Confirmada'),
        countByEstado('Completada'),
        countByEstado('No asistió'),
      ]);

      const totalConAsistencia = completadas + noAsistieron;
      const tasaAsistencia =
        totalConAsistencia > 0 ? Math.round((completadas / totalConAsistencia) * 100) : 0;

      return {
        stats: {
          total,
          pendientes,
          confirmadas,
          completadas,
          noAsistieron,
          tasaAsistencia,
        },
        error: null,
      };
    } catch (error: any) {
      console.error('Error en getStats:', error);
      return { stats: null, error: error.message || 'Error al obtener estadísticas' };
    }
  },
};

async function fetchActiveStudentIdsForBulk(meetings: {
  tipo: 'all' | 'grade' | 'section' | 'students';
  grade?: string;
  section?: string;
  level?: string;
  studentIds?: number[];
}): Promise<{ ids: number[]; error: string | null }> {
  if (meetings.tipo === 'students' && meetings.studentIds?.length) {
    return { ids: meetings.studentIds, error: null };
  }

  if (meetings.tipo === 'grade' && !meetings.grade) {
    return { ids: [], error: 'Debe seleccionar un grado' };
  }

  if (meetings.tipo === 'section' && (!meetings.grade || !meetings.section)) {
    return { ids: [], error: 'Debe seleccionar grado y sección' };
  }

  const { students, error } = await studentsService.getAll({
    active: true,
    fetchAll: true,
    grade: meetings.tipo === 'grade' || meetings.tipo === 'section' ? meetings.grade : undefined,
    section: meetings.tipo === 'section' ? meetings.section : undefined,
    level: meetings.level as import('@/types').EducationalLevel | undefined,
  });

  if (error) {
    return { ids: [], error };
  }

  let filtered = students;
  if (meetings.tipo === 'grade' && meetings.grade) {
    const grades = gradeFilterValues(meetings.grade);
    filtered = students.filter((s) => grades.includes(s.grade));
  } else if (meetings.tipo === 'section' && meetings.grade && meetings.section) {
    const grades = gradeFilterValues(meetings.grade);
    filtered = students.filter((s) => grades.includes(s.grade) && s.section === meetings.section);
  }

  return { ids: filtered.map((s) => s.id), error: null };
}

