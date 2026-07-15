import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from './Layout';
import { faultsService, incidentsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import {
  INCIDENTS_PAGE_SIZE,
} from '@/hooks/queries/useIncidentsQuery';

interface StaffLayoutShellProps {
  requiredRole?: string[];
}

/** Layout staff: páginas cargadas de forma eager (sin Suspense por ruta). */
export function StaffLayoutShell({ requiredRole }: StaffLayoutShellProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    void (async () => {
      await ensureSupabaseReady();
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.faults.list(true),
          queryFn: async () => {
            const { faults, error } = await faultsService.getAll(true);
            if (error) throw new Error(error);
            return faults;
          },
          staleTime: 30 * 60 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.incidents.list({ page: 1 }),
          queryFn: async () => {
            const { incidents, total, error } = await incidentsService.getAll({
              page: 1,
              pageSize: INCIDENTS_PAGE_SIZE,
            });
            if (error) throw new Error(error);
            return { incidents, total };
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.incidents.summary({}),
          queryFn: async () => {
            const { summary, error } = await incidentsService.getListSummary({});
            if (error) throw new Error(error);
            return summary;
          },
          staleTime: 60 * 1000,
        }),
      ]);
    })();
  }, [queryClient]);

  return (
    <Layout requiredRole={requiredRole}>
      <Outlet />
    </Layout>
  );
}
