import type { EducationalLevel } from '@/types';

export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    departureAlerts: () => [...queryKeys.dashboard.all, 'departure-alerts'] as const,
    recentIncidents: () => [...queryKeys.dashboard.all, 'recent-incidents'] as const,
    monthlyTrend: () => [...queryKeys.dashboard.all, 'monthly-trend'] as const,
    weeklyAttendance: () => [...queryKeys.dashboard.all, 'weekly-attendance'] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    list: (filters: { nivelEducativo?: EducationalLevel; search?: string; page?: number }) =>
      [...queryKeys.incidents.all, 'list', filters] as const,
    summary: (filters: { nivelEducativo?: EducationalLevel; search?: string }) =>
      [...queryKeys.incidents.all, 'summary', filters] as const,
    justify: (filters: Record<string, unknown>) =>
      [...queryKeys.incidents.all, 'justify', filters] as const,
  },
  faults: {
    all: ['faults'] as const,
    list: (activeOnly: boolean) => [...queryKeys.faults.all, 'list', activeOnly] as const,
  },
  systemConfig: {
    all: ['system-config'] as const,
    attendance: () => [...queryKeys.systemConfig.all, 'attendance'] as const,
    reincidence: () => [...queryKeys.systemConfig.all, 'reincidence'] as const,
  },
  students: {
    all: ['students'] as const,
    list: (filters: { search?: string; level?: EducationalLevel }) =>
      [...queryKeys.students.all, 'list', filters] as const,
  },
  reports: {
    all: (filters: {
      bimestre?: number;
      añoEscolar: number;
      level?: EducationalLevel;
      grade?: string;
    }) => ['reports', filters] as const,
  },
} as const;
