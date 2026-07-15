import { useState, useMemo } from 'react';
import { EducationalLevel } from '@/types';

/**
 * Hook reutilizable para manejar filtros comunes en listas
 */
export function useFilters<T extends Record<string, any>>(initialFilters: T) {
  const [filters, setFilters] = useState<T>(initialFilters);

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initialValue = initialFilters[key as keyof T];
      return value !== initialValue && value !== 'all' && value !== '';
    });
  }, [filters, initialFilters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    hasActiveFilters,
  };
}

/**
 * Hook específico para filtros de estudiantes/reportes
 */
export function useStudentFilters() {
  return useFilters({
    search: '',
    level: 'all' as 'all' | EducationalLevel,
    grade: 'all' as 'all' | string,
    section: 'all' as 'all' | string,
  });
}

