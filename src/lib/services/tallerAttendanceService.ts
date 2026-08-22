import { supabase } from '../supabaseClient';
import type { TallerAsistencia } from '@/types';
import {
  getLimaNow,
  getLimaTodayDate,
  getLimaMonthBounds,
  getMonthBounds,
} from '@/lib/utils/limaDateTime';

type TallerLlegadaRow = {
  id_registro: number;
  id_estudiante: number;
  fecha: string;
  hora_llegada: string | null;
  hora_salida: string | null;
  registrado_por: number | null;
};

const SELECT_COLS =
  'id_registro, id_estudiante, fecha, hora_llegada, hora_salida, registrado_por';

function truncateTimeHHmm(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 5 ? trimmed.substring(0, 5) : trimmed;
}

export function mapTallerAsistenciaRow(row: TallerLlegadaRow): TallerAsistencia {
  return {
    id: row.id_registro,
    tallerId: 'taller',
    tallerNombre: 'Taller',
    studentId: row.id_estudiante,
    date: row.fecha,
    arrivalTime: truncateTimeHHmm(row.hora_llegada),
    departureTime: truncateTimeHHmm(row.hora_salida),
    arrivalStatus: null,
    departureType: row.hora_salida ? 'Normal' : null,
    registeredBy: row.registrado_por,
  };
}

export type RecordTallerArrivalOptions = {
  date?: string;
  arrivalTime?: string;
};

/** Registra hora de llegada (sin a tiempo/tarde). Una por alumno y día. */
export async function recordArrival(
  _tallerId: string | undefined,
  studentId: number,
  registeredBy?: number,
  options?: RecordTallerArrivalOptions,
): Promise<{ record: TallerAsistencia | null; error: string | null }> {
  try {
    const fecha = options?.date ?? getLimaTodayDate();
    const hora = options?.arrivalTime ?? getLimaNow().time;

    const payload: Record<string, unknown> = {
      id_estudiante: studentId,
      fecha,
      hora_llegada: hora,
    };

    if (registeredBy != null) {
      payload.registrado_por = registeredBy;
    }

    const { data, error } = await supabase
      .from('taller_llegadas')
      .upsert(payload, { onConflict: 'id_estudiante,fecha' })
      .select(SELECT_COLS)
      .single();

    if (error) {
      console.error('Error al registrar llegada de taller:', error);
      return { record: null, error: error.message };
    }

    return { record: mapTallerAsistenciaRow(data as TallerLlegadaRow), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar llegada de taller';
    console.error('Error en recordArrival:', error);
    return { record: null, error: message };
  }
}

/** Registra hora de salida del taller (segundo escaneo del día). */
export async function recordDeparture(
  studentId: number,
  registeredBy?: number,
  date?: string,
): Promise<{
  success: boolean;
  error: string | null;
  departureTime: string | null;
  record: TallerAsistencia | null;
}> {
  try {
    const fecha = date ?? getLimaTodayDate();
    const departureTime = getLimaNow().time;

    const updateData: Record<string, unknown> = {
      hora_salida: departureTime,
    };
    if (registeredBy != null) {
      updateData.registrado_por = registeredBy;
    }

    const { data, error } = await supabase
      .from('taller_llegadas')
      .update(updateData)
      .eq('id_estudiante', studentId)
      .eq('fecha', fecha)
      .not('hora_llegada', 'is', null)
      .is('hora_salida', null)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message, departureTime: null, record: null };
    }

    if (!data) {
      return {
        success: false,
        error: 'No hay llegada de taller o la salida ya fue registrada.',
        departureTime: null,
        record: null,
      };
    }

    return {
      success: true,
      error: null,
      departureTime,
      record: mapTallerAsistenciaRow(data as TallerLlegadaRow),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar salida de taller';
    console.error('Error en recordDeparture:', error);
    return { success: false, error: message, departureTime: null, record: null };
  }
}

export async function fetchRangeForStudents(
  studentIds: number[],
  start: string,
  end: string,
): Promise<{ records: TallerAsistencia[]; error: string | null }> {
  const uniqueIds = [...new Set(studentIds)].filter((id) => id > 0);
  if (uniqueIds.length === 0) {
    return { records: [], error: null };
  }

  try {
    const allRows: TallerLlegadaRow[] = [];
    const batchSize = 150;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('taller_llegadas')
        .select(SELECT_COLS)
        .in('id_estudiante', batch)
        .gte('fecha', start)
        .lte('fecha', end)
        .order('fecha', { ascending: true });

      if (error) {
        console.warn('fetchRangeForStudents:', error.message);
        return { records: [], error: error.message };
      }
      if (data?.length) {
        allRows.push(...(data as TallerLlegadaRow[]));
      }
    }

    return {
      records: allRows.map((row) => mapTallerAsistenciaRow(row)),
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al cargar asistencias de tarde';
    console.warn('fetchRangeForStudents:', message);
    return { records: [], error: message };
  }
}

export async function fetchMonthForStudent(
  studentId: number,
  year?: number,
  month?: number,
): Promise<{ records: TallerAsistencia[]; error: string | null }> {
  try {
    const bounds =
      year != null && month != null ? getMonthBounds(year, month) : getLimaMonthBounds();
    const { start, end } = bounds;

    const { data, error } = await supabase
      .from('taller_llegadas')
      .select(SELECT_COLS)
      .eq('id_estudiante', studentId)
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false });

    if (error) {
      console.warn('fetchMonthForStudent:', error.message);
      return { records: [], error: error.message };
    }

    return {
      records: (data || []).map((row) => mapTallerAsistenciaRow(row as TallerLlegadaRow)),
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al cargar asistencias de taller';
    console.error('Error en fetchMonthForStudent:', error);
    return { records: [], error: message };
  }
}

export const tallerAttendanceService = {
  recordArrival,
  recordDeparture,
  fetchMonthForStudent,
  fetchRangeForStudents,
  mapTallerAsistenciaRow,
};
