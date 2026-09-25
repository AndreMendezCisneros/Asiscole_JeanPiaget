import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { studentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';
import type { EducationalLevel } from '@/types';

export const STUDENTS_PAGE_SIZE = 10;

export interface StudentsListFilters {
  search?: string;
  level?: EducationalLevel;
  grade?: string;
  section?: string;
  page?: number;
  pageSize?: number;
}

interface StudentsListStatsRow {
  sinIncidencias: number;
  nivelModerado: number;
  nivelAlto: number;
}

const EMPTY_STATS: StudentsListStatsRow = {
  sinIncidencias: 0,
  nivelModerado: 0,
  nivelAlto: 0,
};

/**
 * Stats globales de reincidencia — se cachean 5 min y NO bloquean la carga de la
 * lista. Solo hace COUNT sobre la vista, sin traer filas.
 */
async function fetchStudentsStats(filters: Omit<StudentsListFilters, 'page'>): Promise<StudentsListStatsRow> {
  // Query base: IDs de estudiantes que matchean filtros
  let base = supabase.from('estudiantes').select('id_estudiante').eq('activo', true);
  if (filters.level) base = base.eq('nivel_educativo', filters.level);
  if (filters.grade) {
    const { gradeFilterValues } = await import('@/lib/utils/gradeAliases');
    base = base.in('grado', gradeFilterValues(filters.grade));
  }
  if (filters.section) base = base.eq('seccion', filters.section);
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, (m) => `\\${m}`);
    base = base.or(`nombre_completo.ilike.%${term}%,codigo_barras.ilike.%${term}%`);
  }
  const { data: ids, error } = await base;
  if (error || !ids) return EMPTY_STATS;
  const idList = ids.map((r) => (r as Record<string, unknown>).id_estudiante as number);
  if (idList.length === 0) return EMPTY_STATS;

  // Traer nivel_actual solo de los que matchean. En lotes de 1000 para no
  // reventar el URL de PostgREST con .in() muy largo.
  const stats = { ...EMPTY_STATS };
  const chunkSize = 500;
  for (let i = 0; i < idList.length; i += chunkSize) {
    const chunk = idList.slice(i, i + chunkSize);
    const { data: rein } = await supabase
      .from('v_estudiantes_nivel_actual')
      .select('nivel_actual')
      .in('id_estudiante', chunk);
    for (const row of rein ?? []) {
      const nivel = Number((row as Record<string, unknown>).nivel_actual) || 0;
      if (nivel === 0) stats.sinIncidencias += 1;
      else if (nivel <= 2) stats.nivelModerado += 1;
      else stats.nivelAlto += 1;
    }
    // Los IDs sin fila en la vista → sin incidencias
    stats.sinIncidencias += chunk.length - (rein?.length ?? 0);
  }
  return stats;
}

export function useStudentsQuery(filters: StudentsListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? STUDENTS_PAGE_SIZE;
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.students.list({ ...filters, page, pageSize }),
    queryFn: async () => {
      const { students, total, error } = await studentsService.listLite({
        search: filters.search,
        level: filters.level,
        grade: filters.grade,
        section: filters.section,
        active: true,
        page,
        pageSize,
        withReincidence: true,
      });
      if (error) throw new Error(error);
      return { students, total };
    },
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Stats globales — se cachean aparte y no bloquean la lista
  const statsQuery = useQuery({
    queryKey: queryKeys.students.list({
      ...filters,
      page: 'stats' as unknown as number,
      pageSize: 'stats' as unknown as number,
    }),
    queryFn: () =>
      fetchStudentsStats({
        search: filters.search,
        level: filters.level,
        grade: filters.grade,
        section: filters.section,
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Prefetch de la página siguiente para navegación instantánea
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (!listQuery.data || page >= totalPages) return;
    const nextPage = page + 1;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.students.list({ ...filters, page: nextPage, pageSize }),
      queryFn: async () => {
        const { students, total: t, error } = await studentsService.listLite({
          search: filters.search,
          level: filters.level,
          grade: filters.grade,
          section: filters.section,
          active: true,
          page: nextPage,
          pageSize,
          withReincidence: true,
        });
        if (error) throw new Error(error);
        return { students, total: t };
      },
      staleTime: 2 * 60 * 1000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data, page, pageSize, totalPages, filters.search, filters.level, filters.grade, filters.section]);

  return {
    ...listQuery,
    data: listQuery.data
      ? {
          students: listQuery.data.students,
          total: listQuery.data.total,
          stats: statsQuery.data ?? EMPTY_STATS,
        }
      : undefined,
  };
}

export function useInvalidateStudents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
}
