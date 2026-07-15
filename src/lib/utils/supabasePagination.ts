import type { PostgrestError } from '@supabase/supabase-js';

const DEFAULT_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * Recorre páginas de Supabase (límite PostgREST ~1000 filas por petición).
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      return { data: rows, error: error.message };
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: rows, error: null };
}
