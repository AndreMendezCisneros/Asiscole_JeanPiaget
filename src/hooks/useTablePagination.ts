import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSize,
} from '@/lib/constants/tablePagination';

type Options = {
  /** Total de filas (servidor o cliente). */
  totalItems: number;
  /** Tamaño inicial; por defecto 10. */
  initialPageSize?: TablePageSize;
  /** Se llama al cambiar página o tamaño (útil para refetch servidor). */
  onChange?: (page: number, pageSize: number) => void;
};

/**
 * Paginación uniforme: 10 por defecto, flechas + ir a página manual.
 */
export function useTablePagination({
  totalItems,
  initialPageSize = TABLE_PAGE_SIZE,
  onChange,
}: Options) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / pageSize) || 1);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(totalPages, Math.max(1, Math.floor(next) || 1));
      setPage(clamped);
      onChange?.(clamped, pageSize);
    },
    [onChange, pageSize, totalPages],
  );

  const nextPage = useCallback(() => goToPage(page + 1), [goToPage, page]);
  const prevPage = useCallback(() => goToPage(page - 1), [goToPage, page]);

  const changePageSize = useCallback(
    (size: number) => {
      const allowed = (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(size)
        ? size
        : TABLE_PAGE_SIZE;
      setPageSize(allowed);
      setPage(1);
      onChange?.(1, allowed);
    },
    [onChange],
  );

  const resetPage = useCallback(() => {
    setPage(1);
    onChange?.(1, pageSize);
  }, [onChange, pageSize]);

  const sliceRange = useMemo(() => {
    const start = (page - 1) * pageSize;
    return { start, end: start + pageSize };
  }, [page, pageSize]);

  return {
    page,
    pageSize,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
    setPage,
    sliceRange,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  };
}
