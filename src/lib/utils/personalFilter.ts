import type { Personal, PersonalCategoria } from '@/types/personal';

export type CategoryFilter = 'all' | PersonalCategoria;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Filtro por nombre/DNI (cada palabra filtra), categoría y empleado elegido. */
export function matchesPersonalFilter(
  p: Personal,
  search: string,
  category: CategoryFilter,
  employeeId: number | null = null,
): boolean {
  if (employeeId !== null && p.id !== employeeId) return false;
  if (category !== 'all' && p.category !== category) return false;
  const terms = fold(search.trim()).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold(`${p.fullName} ${p.barcode}`);
  return terms.every((t) => haystack.includes(t));
}
