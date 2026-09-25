/** Tamaño de página unificado para tablas staff (listados / reportes operativos). */
export const TABLE_PAGE_SIZE = 10;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];
