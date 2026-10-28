import { supabase } from '../supabaseClient';
import { fetchAllPages } from '@/lib/utils/supabasePagination';
import { ARRIVAL_ESTADO } from '@/lib/utils/attendanceJustification';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import { resolveArrivalLimitForLevel } from '@/lib/utils/arrivalLimit';
import { normalizeTimeValue } from '@/config/systemSettings';
import {
  buildLatenessSummary,
  minutesBetween,
  type ClassroomEnrollment,
  type LatenessRow,
  type LatenessSummary,
} from '@/lib/utils/latenessStats';
import { fetchArrivalLimits } from './arrivalService';
import { buildAbsenceSummary, schoolDaysFrom, type AbsenceSummary } from '@/lib/utils/absenceStats';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';

export interface LatenessFilters {
  /** YYYY-MM-DD, inclusive. */
  dateFrom: string;
  /** YYYY-MM-DD, inclusive. */
  dateTo: string;
  level?: string;
  grade?: string;
  section?: string;
}

const LATE_STATES = [ARRIVAL_ESTADO.LATE, ARRIVAL_ESTADO.LATE_JUSTIFIED];
const ARRIVAL_STATES = [ARRIVAL_ESTADO.ON_TIME, ...LATE_STATES];

type LateRowDB = {
  id_registro: number;
  id_estudiante: number;
  fecha: string;
  hora_llegada: string | null;
  estado: string;
  estudiante: {
    nombre_completo: string | null;
    grado: string | null;
    seccion: string | null;
    nivel_educativo: string | null;
    foto_perfil: string | null;
  } | null;
};

/**
 * Filtros del aula. Con `prefix = 'estudiante.'` se aplican sobre la tabla embebida
 * (el select debe usar `!inner` para que filtren las filas de llegada).
 * Los builders de PostgREST tienen tipos muy profundos; se filtra sin tiparlos.
 */
function applyStudentFilters<Q>(q: Q, filters: LatenessFilters, prefix: string): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let out = q as any;
  if (filters.level) out = out.eq(`${prefix}nivel_educativo`, filters.level);
  if (filters.grade) out = out.in(`${prefix}grado`, gradeFilterValues(filters.grade));
  if (filters.section) out = out.eq(`${prefix}seccion`, filters.section);
  return out as Q;
}

async function fetchLateRows(filters: LatenessFilters) {
  return fetchAllPages<LateRowDB>(async (from, to) =>
    applyStudentFilters(
      supabase
        .from('registros_llegada')
        .select(
          `id_registro, id_estudiante, fecha, hora_llegada, estado,
           estudiante:estudiantes!registros_llegada_id_estudiante_fkey!inner(
             nombre_completo, grado, seccion, nivel_educativo, foto_perfil
           )`,
        )
        .gte('fecha', filters.dateFrom)
        .lte('fecha', filters.dateTo)
        .in('estado', LATE_STATES),
      filters,
      'estudiante.',
    )
      .order('fecha', { ascending: true })
      .order('id_registro', { ascending: true })
      .range(from, to)
      .returns<LateRowDB[]>(),
  );
}

async function fetchEnrollment(filters: LatenessFilters) {
  const { data, error } = await fetchAllPages<{
    nivel_educativo: string | null;
    grado: string | null;
    seccion: string | null;
  }>(async (from, to) =>
    applyStudentFilters(
      supabase.from('estudiantes').select('nivel_educativo, grado, seccion').eq('activo', true),
      filters,
      '',
    )
      .order('id_estudiante', { ascending: true })
      .range(from, to),
  );

  const counts = new Map<string, ClassroomEnrollment>();
  for (const row of data) {
    if (!row.grado || !row.seccion) continue;
    const key = `${row.nivel_educativo ?? ''}|${row.grado}|${row.seccion}`;
    const current = counts.get(key) ?? {
      level: row.nivel_educativo ?? '',
      grade: row.grado,
      section: row.seccion,
      students: 0,
    };
    current.students += 1;
    counts.set(key, current);
  }
  return { enrollment: [...counts.values()], error };
}

/** Llegadas registradas del período (a tiempo + tarde), para el % de tardanzas. */
async function countArrivals(filters: LatenessFilters): Promise<number | null> {
  const hasStudentFilter = Boolean(filters.level || filters.grade || filters.section);
  const select = hasStudentFilter
    ? 'id_registro, estudiante:estudiantes!registros_llegada_id_estudiante_fkey!inner(id_estudiante)'
    : 'id_registro';
  let q = supabase
    .from('registros_llegada')
    .select(select, { count: 'exact', head: true })
    .gte('fecha', filters.dateFrom)
    .lte('fecha', filters.dateTo)
    .in('estado', ARRIVAL_STATES);
  if (hasStudentFilter) q = applyStudentFilters(q, filters, 'estudiante.');
  const { count, error } = await q;
  if (error) return null;
  return count ?? null;
}

/**
 * Tardanzas del período agrupadas por aula y por alumno.
 * Lee solo las llegadas tarde (pocas filas) más los alumnos activos por aula.
 */
export async function getLatenessReport(
  filters: LatenessFilters,
): Promise<{ summary: LatenessSummary | null; error: string | null }> {
  try {
    const [late, enrollment, arrivalsTotal, limits] = await Promise.all([
      fetchLateRows(filters),
      fetchEnrollment(filters),
      countArrivals(filters),
      fetchArrivalLimits(),
    ]);

    if (late.error) return { summary: null, error: late.error };

    const rows: LatenessRow[] = late.data
      .filter((r) => r.estudiante)
      .map((r) => {
        const time = r.hora_llegada ? normalizeTimeValue(r.hora_llegada, '') : '';
        const limit = resolveArrivalLimitForLevel(limits, r.estudiante?.nivel_educativo);
        return {
          recordId: r.id_registro,
          studentId: r.id_estudiante,
          studentName: r.estudiante?.nombre_completo?.trim() || 'Sin nombre',
          photo: r.estudiante?.foto_perfil ?? null,
          level: r.estudiante?.nivel_educativo ?? '',
          grade: r.estudiante?.grado ?? '',
          section: r.estudiante?.seccion ?? '',
          date: String(r.fecha).slice(0, 10),
          time,
          justified: r.estado === ARRIVAL_ESTADO.LATE_JUSTIFIED,
          minutesLate: time ? minutesBetween(time, limit) : null,
        };
      });

    return {
      summary: buildLatenessSummary(rows, enrollment.enrollment, arrivalsTotal),
      error: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener tardanzas';
    console.error('Error en getLatenessReport:', error);
    return { summary: null, error: message };
  }
}

/**
 * Faltas del período: estudiante activo sin llegada en un día con clases
 * (hábil, cerrado y con asistencia tomada), más las «Falta justificada».
 */
export async function getAbsenceReport(
  filters: LatenessFilters,
): Promise<{ summary: AbsenceSummary | null; error: string | null }> {
  try {
    const [studentsRes, arrivalsRes] = await Promise.all([
      fetchAllPages<{ id_estudiante: number; nombre_completo: string | null; grado: string | null; seccion: string | null; nivel_educativo: string | null }>(
        async (from, to) =>
          applyStudentFilters(
            supabase
              .from('estudiantes')
              .select('id_estudiante, nombre_completo, grado, seccion, nivel_educativo')
              .eq('activo', true),
            filters,
            '',
          )
            .order('id_estudiante', { ascending: true })
            .range(from, to),
      ),
      fetchAllPages<{ id_estudiante: number; fecha: string; estado: string }>(async (from, to) =>
        applyStudentFilters(
          supabase
            .from('registros_llegada')
            .select('id_estudiante, fecha, estado, estudiante:estudiantes!registros_llegada_id_estudiante_fkey!inner(id_estudiante)')
            .gte('fecha', filters.dateFrom)
            .lte('fecha', filters.dateTo),
          filters,
          'estudiante.',
        )
          .order('id_registro', { ascending: true })
          .range(from, to),
      ),
    ]);
    if (studentsRes.error) return { summary: null, error: studentsRes.error };
    if (arrivalsRes.error) return { summary: null, error: arrivalsRes.error };

    const arrivals = arrivalsRes.data.map((r) => ({ studentId: r.id_estudiante, date: String(r.fecha).slice(0, 10), estado: r.estado }));
    const days = schoolDaysFrom(arrivals, filters.dateFrom, filters.dateTo, getLimaTodayDate());
    const students = studentsRes.data
      .filter((s) => s.grado && s.seccion)
      .map((s) => ({
        id: s.id_estudiante,
        name: s.nombre_completo?.trim() || 'Sin nombre',
        level: s.nivel_educativo ?? '',
        grade: s.grado ?? '',
        section: s.seccion ?? '',
      }));
    return { summary: buildAbsenceSummary(students, arrivals, days), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener faltas';
    console.error('Error en getAbsenceReport:', error);
    return { summary: null, error: message };
  }
}

export const latenessService = { getLatenessReport, getAbsenceReport };
