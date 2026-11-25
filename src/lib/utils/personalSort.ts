/** Orden de los reportes del personal (pantalla, PDF y Excel). */
export type PersonalSortBy = 'nombre' | 'mas' | 'menos' | 'categoria';

export const PERSONAL_SORT_LABEL: Record<PersonalSortBy, string> = {
  nombre: 'Alfabético (A-Z)',
  mas: 'Más horas primero',
  menos: 'Menos horas primero',
  categoria: 'Por categoría',
};

type WithPersonal = { personal: { fullName: string; category?: string | null } };

/** Devuelve una copia ordenada. `minutes` da las horas que cuentan para "más/menos". */
export function sortPersonalRows<T extends WithPersonal>(
  list: T[],
  sortBy: PersonalSortBy,
  minutes: (row: T) => number,
): T[] {
  const byName = (a: T, b: T) =>
    a.personal.fullName.localeCompare(b.personal.fullName, 'es', { sensitivity: 'base' });
  const out = [...list];
  if (sortBy === 'mas') out.sort((a, b) => minutes(b) - minutes(a) || byName(a, b));
  else if (sortBy === 'menos') out.sort((a, b) => minutes(a) - minutes(b) || byName(a, b));
  else if (sortBy === 'categoria')
    out.sort((a, b) => (a.personal.category ?? '').localeCompare(b.personal.category ?? '', 'es') || byName(a, b));
  else out.sort(byName);
  return out;
}
