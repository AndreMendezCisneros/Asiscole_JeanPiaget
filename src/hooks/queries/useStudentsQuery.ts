import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
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
}

export function useStudentsQuery(filters: StudentsListFilters = {}) {
  const page = filters.page ?? 1;

  return useQuery({
    queryKey: queryKeys.students.list({ ...filters, page }),
    queryFn: async () => {
      const { students, total, stats, error } = await studentsService.getAll({
        search: filters.search,
        level: filters.level,
        grade: filters.grade,
        section: filters.section,
        active: true,
        page,
        pageSize: STUDENTS_PAGE_SIZE,
      });
      if (error) throw new Error(error);
      return { students, total, stats };
    },
    placeholderData: keepPreviousData,
  });
}

export function useInvalidateStudents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.students.all });
}
