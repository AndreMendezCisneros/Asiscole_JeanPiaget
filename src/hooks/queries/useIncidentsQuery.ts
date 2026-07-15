import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';
import type { EducationalLevel } from '@/types';

export const INCIDENTS_PAGE_SIZE = 10;

export interface IncidentsListFilters {
  nivelEducativo?: EducationalLevel;
  search?: string;
  page?: number;
}

export function useIncidentsQuery(filters: IncidentsListFilters = {}) {
  const page = filters.page ?? 1;

  return useQuery({
    queryKey: queryKeys.incidents.list({ ...filters, page }),
    queryFn: async () => {
      const { incidents, total, error } = await incidentsService.getAll({
        nivelEducativo: filters.nivelEducativo,
        search: filters.search,
        page,
        pageSize: INCIDENTS_PAGE_SIZE,
      });
      if (error) throw new Error(error);
      return { incidents, total };
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

export function useIncidentsSummaryQuery(
  filters: Pick<IncidentsListFilters, 'nivelEducativo' | 'search'> = {},
) {
  return useQuery({
    queryKey: queryKeys.incidents.summary(filters),
    queryFn: async () => {
      const { summary, error } = await incidentsService.getListSummary({
        nivelEducativo: filters.nivelEducativo,
        search: filters.search,
      });
      if (error) throw new Error(error);
      return summary;
    },
    staleTime: 60 * 1000,
  });
}

export interface JustifyIncidentsFilters {
  nivelEducativo?: EducationalLevel;
  search?: string;
  page?: number;
  estado?: 'Activa' | 'Justificada';
  fechaDesde?: string;
  fechaHasta?: string;
}

export const JUSTIFY_INCIDENTS_PAGE_SIZE = 20;

export function useJustifyIncidentsQuery(filters: JustifyIncidentsFilters = {}) {
  const page = filters.page ?? 1;

  return useQuery({
    queryKey: queryKeys.incidents.justify({ ...filters, page }),
    queryFn: async () => {
      const { incidents, total, error } = await incidentsService.getAll({
        nivelEducativo: filters.nivelEducativo,
        search: filters.search,
        estado: filters.estado,
        fechaDesde: filters.fechaDesde,
        fechaHasta: filters.fechaHasta,
        page,
        pageSize: JUSTIFY_INCIDENTS_PAGE_SIZE,
      });
      if (error) throw new Error(error);
      return { incidents, total };
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

export function useInvalidateIncidents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.incidents.all });
}
