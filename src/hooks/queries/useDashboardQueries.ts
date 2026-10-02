import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardService, arrivalService, incidentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';

const DEPARTURE_ALERTS_INTERVAL_MS = 5 * 60 * 1000;
const DASHBOARD_STALE_MS = 5 * 60 * 1000;

export type DashboardStatsRange = { startDate: string; endDate: string };

/** Sin rango: año escolar en curso. Con rango: solo ese periodo (misma RPC). */
export function useDashboardStatsQuery(range?: DashboardStatsRange | null, enabled = true) {
  return useQuery({
    queryKey: range
      ? ([...queryKeys.dashboard.stats(), range.startDate, range.endDate] as const)
      : queryKeys.dashboard.stats(),
    queryFn: async () => {
      const { stats, error } = await dashboardService.getDashboardStats(range ?? undefined);
      if (error) throw new Error(error);
      if (!stats) throw new Error('No se recibieron estadísticas del dashboard');
      return stats;
    },
    enabled,
    staleTime: DASHBOARD_STALE_MS,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: 2,
  });
}

export function useDailyTrendQuery(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'daily-trend', year, month] as const,
    queryFn: async () => {
      const { dailyTrend, error } = await dashboardService.getDailyTrend(year, month);
      if (error) throw new Error(error);
      return dailyTrend;
    },
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
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
    queryKey: [...queryKeys.dashboard.monthlyTrend(), 'school-year-v2'] as const,
    queryFn: async () => {
      const { monthlyTrend, error } = await dashboardService.getMonthlyTrend();
      if (error) throw new Error(error);
      return monthlyTrend ?? [];
    },
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useWeeklyAttendanceTrendQuery(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.dashboard.weeklyAttendance(), 'range-v2'] as const,
    queryFn: async () => {
      const { weeklyData, error } = await arrivalService.getWeeklyAttendanceTrend();
      if (error) throw new Error(error);
      return weeklyData ?? [];
    },
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
  });
}
