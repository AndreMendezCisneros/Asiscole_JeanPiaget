/**
 * Patrón `ilike` "contiene" listo para un filtro `.or(...)` de PostgREST.
 * El texto va entre comillas: una coma, punto o paréntesis del usuario («PEREZ, JUAN»)
 * rompía el filtro con 400. `%` y `_` se escapan para buscarlos literalmente.
 */
export function ilikeContainsValue(text: string): string {
  const like = text.replace(/[\\%_]/g, (m) => `\\${m}`);
  return `"%${like.replace(/["\\]/g, (m) => `\\${m}`)}%"`;
}

/** Búsqueda de estudiantes por nombre o código de barras. */
export function studentSearchOrFilter(search: string): string {
  const value = ilikeContainsValue(search.trim());
  return `nombre_completo.ilike.${value},codigo_barras.ilike.${value}`;
}
