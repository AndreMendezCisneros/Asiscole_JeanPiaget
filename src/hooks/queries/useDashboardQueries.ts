import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardService, arrivalService, incidentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';

const DEPARTURE_ALERTS_INTERVAL_MS = 5 * 60 * 1000;
const DASHBOARD_STALE_MS = 5 * 60 * 1000;

export function useDashboardStatsQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async () => {
      const { stats, error } = await dashboardService.getDashboardStats();
      if (error) throw new Error(error);
      if (!stats) throw new Error('No se recibieron estadísticas del dashboard');
      return stats;
    },
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    // Si había un error previo, volver a intentar siempre al montar el componente
    refetchOnMount: true,
  });
}

export function useDepartureAlertsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.departureAlerts(),
    queryFn: async () => {
      const { alerts, error } = await arrivalService.getDepartureAlerts();
      if (error) throw new Error(error);
      return alerts ?? [];
    },
    enabled,
    refetchInterval: DEPARTURE_ALERTS_INTERVAL_MS,
    staleTime: 60 * 1000,
  });
}

export function useRecentIncidentsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentIncidents(),
    queryFn: async () => {
      const { incidents, error } = await incidentsService.getAll({ limit: 6, offset: 0 });
      if (error) throw new Error(error);
      return incidents;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMonthlyTrendQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.monthlyTrend(),
    queryFn: async () => {
      const { monthlyTrend, error } = await dashboardService.getMonthlyTrend();
      if (error) throw new Error(error);
      return monthlyTrend ?? [];
    },
    enabled,
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useWeeklyAttendanceTrendQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboard.weeklyAttendance(),
    queryFn: async () => {
      const { weeklyData, error } = await arrivalService.getWeeklyAttendanceTrend();
      if (error) throw new Error(error);
      return weeklyData ?? [];
    },
    enabled,
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
  });
}
