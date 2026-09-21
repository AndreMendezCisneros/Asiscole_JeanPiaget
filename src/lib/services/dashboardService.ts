import { supabase } from '../supabaseClient';
import { DashboardStats, EducationalLevel } from '@/types';
import { gradeFilterValues } from '@/lib/utils/gradeAliases';
import { getBimestreDates, getCurrentSchoolYear } from '@/lib/utils/bimestreUtils';

/** PostgREST suele limitar a ~1000 filas por request; paginamos. */
const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

type FlatIncident = {
  nivel_reincidencia: number;
  fecha_hora_registro: string;
  id_estudiante: number;
  id_falta: number | null;
};

type StudentMeta = {
  grado: string | null;
  seccion: string | null;
  nivel_educativo: string | null;
};

type DateRange = { fechaDesde?: string; fechaHasta?: string };

/** Año escolar Perú: marzo del año → fin de febrero del siguiente. */
function buildMonthWindows(year?: number): Array<{ label: string; desde: string; hasta: string }> {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  const currentMonth = now.getMonth();
  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const months: Array<{ label: string; desde: string; hasta: string }> = [];
  for (let i = 4; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    months.push({
      label: monthLabels[date.getMonth()],
      desde: start.toISOString(),
      hasta: end.toISOString(),
    });
  }
  return months;
}

function buildWeekdayWindows(): Array<{ label: string; desde: string; hasta: string }> {
  const now = new Date();
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const weekDays: Array<{ date: Date; label: string }> = [];
  let daysBack = 0;
  while (weekDays.length < 5) {
    const date = new Date(now);
    date.setDate(now.getDate() - daysBack);
    const dayOfWeek = date.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekDays.push({ date, label: dayLabels[dayOfWeek] });
    }
    daysBack++;
    if (daysBack > 14) break;
  }
  weekDays.sort((a, b) => a.date.getTime() - b.date.getTime());
  return weekDays.map(({ date, label }) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { label, desde: start.toISOString(), hasta: end.toISOString() };
  });
}

function emptyStats(): DashboardStats {
  return {
    totalIncidents: 0,
    incidentsToday: 0,
    incidentsThisWeek: 0,
    incidentsThisMonth: 0,
    studentsWithIncidents: 0,
    averageReincidenceLevel: 0,
    levelDistribution: {
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
      level5: 0,
    },
    topFaults: [],
    incidentsByGrade: [],
  };
}

function isMissingRpcError(message?: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('could not find the function') ||
    (m.includes('sie_reportes_bundle') && m.includes('does not exist')) ||
    m.includes('pgrst202') ||
    m.includes('404')
  );
}

/** Año escolar Perú: marzo del año → fin de febrero del siguiente. */
function schoolYearRange(añoEscolar: number): { fechaDesde: string; fechaHasta: string } {
  const inicio = new Date(añoEscolar, 2, 1, 0, 0, 0, 0);
  const fin = new Date(añoEscolar + 1, 1, 28, 23, 59, 59, 999);
  if (new Date(añoEscolar + 1, 1, 29).getMonth() === 1) {
    fin.setDate(29);
  }
  return { fechaDesde: inicio.toISOString(), fechaHasta: fin.toISOString() };
}

function resolveReportDateRange(filters?: {
  bimestre?: number;
  añoEscolar?: number;
  startDate?: string;
  endDate?: string;
}): DateRange {
  if (filters?.bimestre && filters?.añoEscolar) {
    const { inicio, fin } = getBimestreDates(filters.bimestre as 1 | 2 | 3 | 4, filters.añoEscolar);
    return { fechaDesde: inicio.toISOString(), fechaHasta: fin.toISOString() };
  }
  if (filters?.startDate && filters?.endDate) {
    return { fechaDesde: filters.startDate, fechaHasta: filters.endDate };
  }
  if (filters?.añoEscolar) {
    return schoolYearRange(filters.añoEscolar);
  }
  return schoolYearRange(getCurrentSchoolYear());
}

async function fetchFlatActiveIncidents(options?: DateRange & { studentIds?: number[] }): Promise<FlatIncident[]> {
  const fetchPage = async (from: number, to: number) => {
    let query = supabase
      .from('incidencias')
      .select('nivel_reincidencia, fecha_hora_registro, id_estudiante, id_falta')
      .eq('estado', 'Activa')
      .order('id_incidencia', { ascending: true })
      .range(from, to);

    if (options?.fechaDesde) query = query.gte('fecha_hora_registro', options.fechaDesde);
    if (options?.fechaHasta) query = query.lte('fecha_hora_registro', options.fechaHasta);
    if (options?.studentIds?.length) query = query.in('id_estudiante', options.studentIds);

    return query;
  };

  // Primera página
  const first = await fetchPage(0, PAGE_SIZE - 1);
  if (first.error) {
    console.error('Error al cargar incidencias del dashboard:', first.error);
    return [];
  }
  const rows: FlatIncident[] = [...(first.data ?? [])];
  if (rows.length < PAGE_SIZE) return rows;

  // Siguientes páginas en lotes paralelos (4 a la vez) — corta latencia secuencial
  let from = PAGE_SIZE;
  const PARALLEL = 4;
  while (true) {
    const batch = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => {
        const start = from + i * PAGE_SIZE;
        return fetchPage(start, start + PAGE_SIZE - 1);
      }),
    );

    let exhausted = false;
    for (const page of batch) {
      if (page.error) {
        console.error('Error al paginar incidencias:', page.error);
        exhausted = true;
        break;
      }
      const data = page.data ?? [];
      rows.push(...data);
      if (data.length < PAGE_SIZE) {
        exhausted = true;
        break;
      }
    }
    if (exhausted) break;
    from += PARALLEL * PAGE_SIZE;
  }

  return rows;
}

async function fetchStudentsMap(ids: number[]): Promise<Map<number, StudentMeta>> {
  const map = new Map<number, StudentMeta>();
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('estudiantes')
      .select('id_estudiante, grado, seccion, nivel_educativo')
      .in('id_estudiante', chunk);

    if (error) {
      console.error('Error al cargar estudiantes del dashboard:', error);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.id_estudiante, {
        grado: row.grado,
        seccion: row.seccion,
        nivel_educativo: row.nivel_educativo,
      });
    }
  }
  return map;
}

async function fetchFaultNamesMap(ids: Array<number | null>): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unique = [...new Set(ids.filter((id): id is number => id != null && Number.isFinite(id)))];
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const { data, error } = await supabase
      .from('catalogo_faltas')
      .select('id_falta, nombre_falta')
      .in('id_falta', chunk);

    if (error) {
      console.error('Error al cargar faltas del dashboard:', error);
      continue;
    }
    for (const row of data ?? []) {
      map.set(row.id_falta, row.nombre_falta || 'Desconocida');
    }
  }
  return map;
}

async function resolveStudentIds(filters?: {
  level?: EducationalLevel;
  grade?: string;
}): Promise<number[] | undefined> {
  if (!filters?.level && !filters?.grade) return undefined;

  let q = supabase.from('estudiantes').select('id_estudiante');
  if (filters.level) q = q.eq('nivel_educativo', filters.level);
  if (filters.grade) q = q.in('grado', gradeFilterValues(filters.grade));

  const { data, error } = await q;
  if (error) {
    console.error('Error al filtrar estudiantes:', error);
    return [];
  }
  return (data ?? []).map((s) => s.id_estudiante);
}

async function countActiveIncidents(opts: {
  fechaDesde: string;
  fechaHasta: string;
  studentIds?: number[];
}): Promise<number> {
  // Sin filtro de alumnos: un solo HEAD count (muy rápido).
  if (!opts.studentIds) {
    const { count, error } = await supabase
      .from('incidencias')
      .select('id_incidencia', { count: 'exact', head: true })
      .eq('estado', 'Activa')
      .gte('fecha_hora_registro', opts.fechaDesde)
      .lte('fecha_hora_registro', opts.fechaHasta);

    if (error) {
      console.error('Error al contar incidencias:', error);
      return 0;
    }
    return count ?? 0;
  }

  if (opts.studentIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < opts.studentIds.length; i += IN_CHUNK) {
    const chunk = opts.studentIds.slice(i, i + IN_CHUNK);
    const { count, error } = await supabase
      .from('incidencias')
      .select('id_incidencia', { count: 'exact', head: true })
      .eq('estado', 'Activa')
      .gte('fecha_hora_registro', opts.fechaDesde)
      .lte('fecha_hora_registro', opts.fechaHasta)
      .in('id_estudiante', chunk);

    if (error) {
      console.error('Error al contar incidencias filtradas:', error);
      continue;
    }
    total += count ?? 0;
  }
  return total;
}

function aggregateDashboardIncidents(
  rows: FlatIncident[],
  students: Map<number, StudentMeta>,
  faults: Map<number, string>,
  opts: { hoy: Date; inicioSemana: Date },
) {
  const hoyMs = opts.hoy.getTime();
  const weekMs = opts.inicioSemana.getTime();

  const levelCounts = [0, 0, 0, 0, 0, 0];
  let todayCount = 0;
  let weekCount = 0;
  const gradoCounts: Record<string, { level: EducationalLevel; grade: string; count: number }> = {};
  const faltasCounts: Record<string, number> = {};

  for (const inc of rows) {
    const ts = new Date(inc.fecha_hora_registro).getTime();
    if (ts >= hoyMs) todayCount += 1;
    if (ts >= weekMs) weekCount += 1;

    const lvl = Math.min(5, Math.max(0, Number(inc.nivel_reincidencia) || 0));
    levelCounts[lvl] += 1;

    const est = students.get(inc.id_estudiante);
    const grado = est?.grado || 'Sin grado';
    const nivel = (est?.nivel_educativo || 'Secundaria') as EducationalLevel;
    const key = `${nivel}-${grado}`;
    if (!gradoCounts[key]) {
      gradoCounts[key] = { level: nivel, grade: grado, count: 0 };
    }
    gradoCounts[key].count += 1;

    const faultName =
      (inc.id_falta != null ? faults.get(inc.id_falta) : undefined) || 'Desconocida';
    faltasCounts[faultName] = (faltasCounts[faultName] || 0) + 1;
  }

  const totalForAvg = levelCounts.reduce((s, n) => s + n, 0);
  const avgLevel =
    totalForAvg > 0 ? levelCounts.reduce((s, n, i) => s + i * n, 0) / totalForAvg : 0;

  return {
    totalCount: rows.length,
    todayCount,
    weekCount,
    levelDistribution: {
      level0: levelCounts[0],
      level1: levelCounts[1],
      level2: levelCounts[2],
      level3: levelCounts[3],
      level4: levelCounts[4],
      level5: levelCounts[5],
    },
    avgLevel,
    incidentsByGrade: Object.values(gradoCounts).map((entry) => ({
      ...entry,
      label: `${entry.level} • ${entry.grade}`,
    })),
    topFaults: Object.entries(faltasCounts)
      .map(([faultType, count]) => ({ faultType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

type GradeComparisonRow = {
  grade: string;
  level: EducationalLevel;
  label: string;
  totalIncidents: number;
  studentsWithIncidents: number;
  averageReincidence: number;
  levelDistribution: {
    level0: number;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
  };
};

type SectionComparisonRow = {
  section: string;
  grade: string;
  level: EducationalLevel;
  label: string;
  totalIncidents: number;
  studentsWithIncidents: number;
  averageReincidence: number;
};

type ReportsPageResult = {
  stats: DashboardStats | null;
  byGrade: GradeComparisonRow[];
  bySection: SectionComparisonRow[];
  monthlyTrend: { month: string; incidents: number }[];
  weeklyData: { day: string; count: number }[];
  error: string | null;
  source: 'rpc' | 'client';
};

function buildComparisons(
  rows: FlatIncident[],
  students: Map<number, StudentMeta>,
): { byGrade: GradeComparisonRow[]; bySection: SectionComparisonRow[] } {
  const gradeGroups: Record<
    string,
    {
      grade: string;
      level: EducationalLevel;
      students: Set<number>;
      niveles: number[];
    }
  > = {};
  const sectionGroups: Record<
    string,
    {
      section: string;
      grade: string;
      level: EducationalLevel;
      students: Set<number>;
      niveles: number[];
    }
  > = {};

  for (const inc of rows) {
    const est = students.get(inc.id_estudiante);
    if (!est) continue;

    const nivel = (est.nivel_educativo || 'Secundaria') as EducationalLevel;
    const grado = est.grado || 'Sin grado';
    const seccion = est.seccion || 'Sin sección';
    const n = Number(inc.nivel_reincidencia) || 0;

    const gKey = `${nivel}-${grado}`;
    if (!gradeGroups[gKey]) {
      gradeGroups[gKey] = { grade: grado, level: nivel, students: new Set(), niveles: [] };
    }
    gradeGroups[gKey].students.add(inc.id_estudiante);
    gradeGroups[gKey].niveles.push(n);

    const sKey = `${nivel}-${grado}-${seccion}`;
    if (!sectionGroups[sKey]) {
      sectionGroups[sKey] = {
        section: seccion,
        grade: grado,
        level: nivel,
        students: new Set(),
        niveles: [],
      };
    }
    sectionGroups[sKey].students.add(inc.id_estudiante);
    sectionGroups[sKey].niveles.push(n);
  }

  const byGrade = Object.values(gradeGroups)
    .map((group) => {
      const averageReincidence =
        group.niveles.length > 0
          ? group.niveles.reduce((sum, v) => sum + v, 0) / group.niveles.length
          : 0;
      return {
        grade: group.grade,
        level: group.level,
        label: `${group.level} • ${group.grade}`,
        totalIncidents: group.niveles.length,
        studentsWithIncidents: group.students.size,
        averageReincidence: Math.round(averageReincidence * 100) / 100,
        levelDistribution: {
          level0: group.niveles.filter((v) => v === 0).length,
          level1: group.niveles.filter((v) => v === 1).length,
          level2: group.niveles.filter((v) => v === 2).length,
          level3: group.niveles.filter((v) => v === 3).length,
          level4: group.niveles.filter((v) => v === 4).length,
        },
      };
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'Primaria' ? -1 : 1;
      return a.grade.localeCompare(b.grade);
    });

  const bySection = Object.values(sectionGroups)
    .map((group) => {
      const averageReincidence =
        group.niveles.length > 0
          ? group.niveles.reduce((sum, v) => sum + v, 0) / group.niveles.length
          : 0;
      return {
        section: group.section,
        grade: group.grade,
        level: group.level,
        label: `${group.level} • ${group.grade} ${group.section}`,
        totalIncidents: group.niveles.length,
        studentsWithIncidents: group.students.size,
        averageReincidence: Math.round(averageReincidence * 100) / 100,
      };
    })
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === 'Primaria' ? -1 : 1;
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      return a.section.localeCompare(b.section);
    });

  return { byGrade, bySection };
}

/**
 * Servicio de dashboard y reportes
 */
export const dashboardService = {
  /**
   * Obtener estadísticas del dashboard ejecutivo
   */
  async getDashboardStats(filters?: {
    bimestre?: number;
    añoEscolar?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ stats: DashboardStats | null; error: string | null }> {
    try {
      const { fechaDesde, fechaHasta } = resolveReportDateRange(filters);

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay());

      const [{ data: executiveData }, leanRows] = await Promise.all([
        supabase.from('v_dashboard_ejecutivo').select('*').single(),
        fetchFlatActiveIncidents({ fechaDesde, fechaHasta }),
      ]);

      const [students, faults] = await Promise.all([
        fetchStudentsMap(leanRows.map((r) => r.id_estudiante)),
        fetchFaultNamesMap(leanRows.map((r) => r.id_falta)),
      ]);

      const aggregated = aggregateDashboardIncidents(leanRows, students, faults, {
        hoy,
        inicioSemana,
      });

      const stats: DashboardStats = {
        totalIncidents: aggregated.totalCount,
        incidentsToday: aggregated.todayCount,
        incidentsThisWeek: aggregated.weekCount,
        incidentsThisMonth: executiveData?.total_incidencias_mes || 0,
        studentsWithIncidents: executiveData?.estudiantes_afectados_mes || 0,
        averageReincidenceLevel: Math.round(aggregated.avgLevel * 100) / 100,
        levelDistribution: aggregated.levelDistribution,
        topFaults: aggregated.topFaults,
        incidentsByGrade: aggregated.incidentsByGrade,
      };

      return { stats, error: null };
    } catch (error: any) {
      console.error('Error en getDashboardStats:', error);
      return { stats: null, error: error.message || 'Error al obtener estadísticas' };
    }
  },

  /**
   * Obtener estadísticas por bimestre
   */
  async getBimestralStats(
    bimestre: number,
    añoEscolar: number,
    _filters?: {
      level?: EducationalLevel;
      grade?: string;
      section?: string;
    },
  ): Promise<{ stats: DashboardStats | null; error: string | null }> {
    return this.getDashboardStats({ bimestre, añoEscolar });
  },

  /**
   * Tendencia mensual (últimos 5 meses).
   * Sin filtro de aula: HEAD count por mes. Con filtro: una pasada flat del rango.
   */
  async getMonthlyTrend(
    year?: number,
    level?: EducationalLevel,
    grade?: string,
  ): Promise<{ monthlyTrend: { month: string; incidents: number }[]; error: string | null }> {
    try {
      const now = new Date();
      const currentYear = year || now.getFullYear();
      const currentMonth = now.getMonth();

      const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const months: { month: number; year: number; label: string; key: string }[] = [];
      for (let i = 4; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        months.push({
          month: date.getMonth(),
          year: date.getFullYear(),
          label: monthLabels[date.getMonth()],
          key: `${date.getFullYear()}-${date.getMonth()}`,
        });
      }

      const studentIds = await resolveStudentIds({ level, grade });
      if (studentIds && studentIds.length === 0) {
        return {
          monthlyTrend: months.map(({ label }) => ({ month: label, incidents: 0 })),
          error: null,
        };
      }

      // Vista global: 5 HEAD counts en paralelo (sin transferir filas).
      if (!studentIds) {
        const monthlyTrend = await Promise.all(
          months.map(async ({ month, year: y, label }) => {
            const start = new Date(y, month, 1, 0, 0, 0, 0);
            const end = new Date(y, month + 1, 0, 23, 59, 59, 999);
            const incidents = await countActiveIncidents({
              fechaDesde: start.toISOString(),
              fechaHasta: end.toISOString(),
            });
            return { month: label, incidents };
          }),
        );
        return { monthlyTrend, error: null };
      }

      const rangeStart = new Date(months[0].year, months[0].month, 1, 0, 0, 0, 0);
      const last = months[months.length - 1];
      const rangeEnd = new Date(last.year, last.month + 1, 0, 23, 59, 59, 999);
      const rows = await fetchFlatActiveIncidents({
        fechaDesde: rangeStart.toISOString(),
        fechaHasta: rangeEnd.toISOString(),
        studentIds,
      });

      const buckets = new Map(months.map((m) => [m.key, 0]));
      for (const row of rows) {
        const d = new Date(row.fecha_hora_registro);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      return {
        monthlyTrend: months.map(({ label, key }) => ({
          month: label,
          incidents: buckets.get(key) || 0,
        })),
        error: null,
      };
    } catch (error: any) {
      console.error('Error en getMonthlyTrend:', error);
      return { monthlyTrend: [], error: error.message || 'Error al obtener tendencia mensual' };
    }
  },

  /**
   * Datos semanales (últimos 5 días hábiles).
   */
  async getWeeklyData(
    level?: EducationalLevel,
    grade?: string,
  ): Promise<{ weeklyData: { day: string; count: number }[]; error: string | null }> {
    try {
      const now = new Date();
      const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

      const weekDays: { date: Date; label: string; key: string }[] = [];
      let daysBack = 0;
      while (weekDays.length < 5) {
        const date = new Date(now);
        date.setDate(now.getDate() - daysBack);
        const dayOfWeek = date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const day = new Date(date);
          day.setHours(0, 0, 0, 0);
          weekDays.push({
            date: day,
            label: dayLabels[dayOfWeek],
            key: day.toISOString().slice(0, 10),
          });
        }
        daysBack++;
        if (daysBack > 14) break;
      }
      weekDays.sort((a, b) => a.date.getTime() - b.date.getTime());

      const studentIds = await resolveStudentIds({ level, grade });
      if (studentIds && studentIds.length === 0) {
        return {
          weeklyData: weekDays.map(({ label }) => ({ day: label, count: 0 })),
          error: null,
        };
      }

      if (!studentIds) {
        const weeklyData = await Promise.all(
          weekDays.map(async ({ date, label }) => {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            const count = await countActiveIncidents({
              fechaDesde: start.toISOString(),
              fechaHasta: end.toISOString(),
            });
            return { day: label, count };
          }),
        );
        return { weeklyData, error: null };
      }

      const rangeStart = new Date(weekDays[0].date);
      rangeStart.setHours(0, 0, 0, 0);
      const rangeEnd = new Date(weekDays[weekDays.length - 1].date);
      rangeEnd.setHours(23, 59, 59, 999);
      const rows = await fetchFlatActiveIncidents({
        fechaDesde: rangeStart.toISOString(),
        fechaHasta: rangeEnd.toISOString(),
        studentIds,
      });

      const buckets = new Map(weekDays.map((d) => [d.key, 0]));
      for (const row of rows) {
        const key = new Date(row.fecha_hora_registro).toISOString().slice(0, 10);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      return {
        weeklyData: weekDays.map(({ label, key }) => ({
          day: label,
          count: buckets.get(key) || 0,
        })),
        error: null,
      };
    } catch (error: any) {
      console.error('Error en getWeeklyData:', error);
      return { weeklyData: [], error: error.message || 'Error al obtener datos semanales' };
    }
  },

  /**
   * Página Reportes completa: RPC en Postgres (rápido) o fallback cliente.
   */
  async getReportsPage(filters?: {
    bimestre?: number;
    añoEscolar?: number;
    level?: EducationalLevel;
    grade?: string;
  }): Promise<ReportsPageResult> {
    const range = resolveReportDateRange({
      bimestre: filters?.bimestre,
      añoEscolar: filters?.añoEscolar,
    });
    const meses = buildMonthWindows(filters?.añoEscolar);
    const dias = buildWeekdayWindows();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const grados = filters?.grade ? gradeFilterValues(filters.grade) : null;

    // 1) Intentar RPC (1 round-trip + agregación en DB)
    try {
      const { data, error } = await supabase.rpc('sie_reportes_bundle', {
        p_fecha_desde: range.fechaDesde,
        p_fecha_hasta: range.fechaHasta,
        p_nivel: filters?.level ?? null,
        p_grados: grados,
        p_hoy: hoy.toISOString(),
        p_inicio_semana: inicioSemana.toISOString(),
        p_meses: meses,
        p_dias: dias,
      });

      if (!error && data && typeof data === 'object' && !(data as { error?: string }).error) {
        const payload = data as Record<string, unknown>;
        const ld = (payload.levelDistribution || {}) as Record<string, number>;
        const stats: DashboardStats = {
          totalIncidents: Number(payload.totalIncidents) || 0,
          incidentsToday: Number(payload.incidentsToday) || 0,
          incidentsThisWeek: Number(payload.incidentsThisWeek) || 0,
          incidentsThisMonth: Number(payload.incidentsThisMonth) || 0,
          studentsWithIncidents: Number(payload.studentsWithIncidents) || 0,
          averageReincidenceLevel: Number(payload.averageReincidenceLevel) || 0,
          levelDistribution: {
            level0: Number(ld.level0) || 0,
            level1: Number(ld.level1) || 0,
            level2: Number(ld.level2) || 0,
            level3: Number(ld.level3) || 0,
            level4: Number(ld.level4) || 0,
            level5: Number(ld.level5) || 0,
          },
          topFaults: (payload.topFaults as DashboardStats['topFaults']) || [],
          incidentsByGrade: (payload.incidentsByGrade as DashboardStats['incidentsByGrade']) || [],
        };

        return {
          stats,
          byGrade: (payload.byGrade as GradeComparisonRow[]) || [],
          bySection: (payload.bySection as SectionComparisonRow[]) || [],
          monthlyTrend: (payload.monthlyTrend as { month: string; incidents: number }[]) || [],
          weeklyData: (payload.weeklyData as { day: string; count: number }[]) || [],
          error: null,
          source: 'rpc',
        };
      }

      if (error && !isMissingRpcError(error.message)) {
        console.warn('[reportes] RPC falló, usando fallback cliente:', error.message);
      }
    } catch (err: any) {
      if (!isMissingRpcError(err?.message)) {
        console.warn('[reportes] RPC no disponible, fallback cliente:', err?.message);
      }
    }

    // 2) Fallback: una pasada flat + head counts (más lento)
    const [bundle, trendResult, weeklyResult] = await Promise.all([
      this.getReportsBundleClient(filters),
      this.getMonthlyTrend(filters?.añoEscolar, filters?.level, filters?.grade),
      this.getWeeklyData(filters?.level, filters?.grade),
    ]);

    return {
      stats: bundle.stats,
      byGrade: bundle.byGrade,
      bySection: bundle.bySection,
      monthlyTrend: trendResult.monthlyTrend ?? [],
      weeklyData: weeklyResult.weeklyData ?? [],
      error: bundle.error || trendResult.error || weeklyResult.error,
      source: 'client',
    };
  },

  /**
   * Stats + comparaciones en cliente (fallback si falta la RPC).
   */
  async getReportsBundle(filters?: {
    bimestre?: number;
    añoEscolar?: number;
    level?: EducationalLevel;
    grade?: string;
  }): Promise<{
    stats: DashboardStats | null;
    byGrade: GradeComparisonRow[];
    bySection: SectionComparisonRow[];
    error: string | null;
  }> {
    const page = await this.getReportsPage(filters);
    return {
      stats: page.stats,
      byGrade: page.byGrade,
      bySection: page.bySection,
      error: page.error,
    };
  },

  async getReportsBundleClient(filters?: {
    bimestre?: number;
    añoEscolar?: number;
    level?: EducationalLevel;
    grade?: string;
  }): Promise<{
    stats: DashboardStats | null;
    byGrade: GradeComparisonRow[];
    bySection: SectionComparisonRow[];
    error: string | null;
  }> {
    try {
      const range = resolveReportDateRange({
        bimestre: filters?.bimestre,
        añoEscolar: filters?.añoEscolar,
      });

      const studentIds = await resolveStudentIds({
        level: filters?.level,
        grade: filters?.grade,
      });
      if (studentIds && studentIds.length === 0) {
        return { stats: emptyStats(), byGrade: [], bySection: [], error: null };
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay());

      const [{ data: executiveData }, leanRows] = await Promise.all([
        supabase.from('v_dashboard_ejecutivo').select('*').single(),
        fetchFlatActiveIncidents({ ...range, studentIds }),
      ]);

      const [students, faults] = await Promise.all([
        fetchStudentsMap(leanRows.map((r) => r.id_estudiante)),
        fetchFaultNamesMap(leanRows.map((r) => r.id_falta)),
      ]);

      const aggregated = aggregateDashboardIncidents(leanRows, students, faults, {
        hoy,
        inicioSemana,
      });
      const { byGrade, bySection } = buildComparisons(leanRows, students);

      const stats: DashboardStats = {
        totalIncidents: aggregated.totalCount,
        incidentsToday: aggregated.todayCount,
        incidentsThisWeek: aggregated.weekCount,
        incidentsThisMonth: executiveData?.total_incidencias_mes || 0,
        studentsWithIncidents: executiveData?.estudiantes_afectados_mes || 0,
        averageReincidenceLevel: Math.round(aggregated.avgLevel * 100) / 100,
        levelDistribution: aggregated.levelDistribution,
        topFaults: aggregated.topFaults,
        incidentsByGrade: aggregated.incidentsByGrade,
      };

      return { stats, byGrade, bySection, error: null };
    } catch (error: any) {
      console.error('Error en getReportsBundleClient:', error);
      return {
        stats: null,
        byGrade: [],
        bySection: [],
        error: error.message || 'Error al obtener reportes',
      };
    }
  },

  /**
   * Comparaciones por grado y sección en una sola pasada (mismo set de filas).
   */
  async getComparisons(filters?: {
    level?: EducationalLevel;
    grade?: string;
    bimestre?: number;
    añoEscolar?: number;
  }): Promise<{
    byGrade: GradeComparisonRow[];
    bySection: SectionComparisonRow[];
    error: string | null;
  }> {
    try {
      const range = resolveReportDateRange({
        bimestre: filters?.bimestre,
        añoEscolar: filters?.añoEscolar,
      });

      const studentIds = await resolveStudentIds({
        level: filters?.level,
        grade: filters?.grade,
      });
      if (studentIds && studentIds.length === 0) {
        return { byGrade: [], bySection: [], error: null };
      }

      const rows = await fetchFlatActiveIncidents({
        ...range,
        studentIds,
      });
      const students = await fetchStudentsMap(rows.map((r) => r.id_estudiante));
      const { byGrade, bySection } = buildComparisons(rows, students);
      return { byGrade, bySection, error: null };
    } catch (error: any) {
      console.error('Error en getComparisons:', error);
      return {
        byGrade: [],
        bySection: [],
        error: error.message || 'Error al obtener comparaciones',
      };
    }
  },

  async getComparisonByGrade(filters?: {
    level?: EducationalLevel;
    bimestre?: number;
    añoEscolar?: number;
  }): Promise<{ comparison: GradeComparisonRow[]; error: string | null }> {
    const { byGrade, error } = await this.getComparisons(filters);
    return { comparison: byGrade, error };
  },

  async getComparisonBySection(filters?: {
    level?: EducationalLevel;
    grade?: string;
    bimestre?: number;
    añoEscolar?: number;
  }): Promise<{ comparison: SectionComparisonRow[]; error: string | null }> {
    const { bySection, error } = await this.getComparisons(filters);
    return { comparison: bySection, error };
  },
};
