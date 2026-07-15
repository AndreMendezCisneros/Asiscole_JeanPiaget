/** Variantes de grado en BD (importaciones antiguas usan "4" en lugar de "4to"). */
const GRADE_ALIASES: Record<string, string[]> = {
  '1ro': ['1ro', '1'],
  '2do': ['2do', '2'],
  '3ro': ['3ro', '3'],
  '4to': ['4to', '4'],
  '5to': ['5to', '5'],
  '6to': ['6to', '6'],
};

export function gradeFilterValues(grade: string): string[] {
  const trimmed = grade.trim();
  return GRADE_ALIASES[trimmed] ?? [trimmed];
}
