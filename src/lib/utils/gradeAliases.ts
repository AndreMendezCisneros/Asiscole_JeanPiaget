/** Valores exactos para filtrar grado/piso. Sin alias 2do→2 (chocaría con salón 2). */
export function gradeFilterValues(grade: string): string[] {
  const trimmed = grade.trim();
  return trimmed ? [trimmed] : [];
}
