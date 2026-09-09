import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';
import type { EducationalLevel, EstadoEvidencia, EstadoIncidencia, FaultSeverity } from '@/types';
import type { RevisadoAppEstado } from '@/lib/utils/revisadoAppEstado';

export const INCIDENTS_PAGE_SIZE = 10;

export interface IncidentsListFilters {
  nivelEducativo?: EducationalLevel;
  search?: string;
  page?: number;
  grado?: string;
  seccion?: string;
  estado?: EstadoIncidencia;
  fechaDesde?: string;
  fechaHasta?: string;
  nivelReincidencia?: number;
  estadoEvidencia?: EstadoEvidencia;
  gravedad?: FaultSeverity;
  revisado?: RevisadoAppEstado;
}

function toServiceFilters(filters: IncidentsListFilters) {
  return {
    nivelEducativo: filters.nivelEducativo,
    search: filters.search,
    grado: filters.grado,
    seccion: filters.seccion,
    estado: filters.estado,
    fechaDesde: filters.fechaDesde,
    fechaHasta: filters.fechaHasta,
    nivelReincidencia: filters.nivelReincidencia,
    estadoEvidencia: filters.estadoEvidencia,
    gravedad: filters.gravedad,
    revisado: filters.revisado,
  };
}

export function useIncidentsQuery(filters: IncidentsListFilters = {}) {
  const page = filters.page ?? 1;
  const serviceFilters = toServiceFilters(filters);

  return useQuery({
    queryKey: queryKeys.incidents.list({ ...serviceFilters, page }),
    queryFn: async () => {
      const { incidents, total, error } = await incidentsService.getAll({
        ...serviceFilters,
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
  filters: Omit<IncidentsListFilters, 'page'> = {},
) {
  const serviceFilters = toServiceFilters(filters);
  return useQuery({
    queryKey: queryKeys.incidents.summary(serviceFilters),
    queryFn: async () => {
      const { summary, error } = await incidentsService.getListSummary(serviceFilters);
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
