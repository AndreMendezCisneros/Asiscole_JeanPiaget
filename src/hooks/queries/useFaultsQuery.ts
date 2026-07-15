import { useQuery, useQueryClient } from '@tanstack/react-query';
import { faultsService } from '@/lib/services';
import { queryKeys } from '@/lib/query/queryKeys';

const FAULTS_STALE_MS = 30 * 60 * 1000;

export function useFaultsQuery(activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.faults.list(activeOnly),
    queryFn: async () => {
      const { faults, error } = await faultsService.getAll(activeOnly);
      if (error) throw new Error(error);
      return faults;
    },
    staleTime: FAULTS_STALE_MS,
    gcTime: FAULTS_STALE_MS * 2,
  });
}

export function useInvalidateFaults() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.faults.all });
}
