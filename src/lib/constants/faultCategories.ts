export const DEFAULT_FAULT_CATEGORIES = [
  'Conducta',
  'Uniforme',
  'Académica',
  'Puntualidad',
] as const;

export const FAULT_CATEGORIES_CONFIG_KEY = 'categorias_faltas';

export function mergeFaultCategories(
  stored: string[] | undefined,
  fromFaults: Array<{ category: string }>,
): string[] {
  const set = new Set<string>([
    ...DEFAULT_FAULT_CATEGORIES,
    ...(stored ?? []),
    ...fromFaults.map((f) => f.category),
  ]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}
