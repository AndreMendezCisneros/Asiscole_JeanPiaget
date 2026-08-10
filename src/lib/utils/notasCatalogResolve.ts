import type { NotasArea, NotasCarrera } from '@/types/notas';

function fold(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resuelve área + carrera desde texto libre del Excel (o UI).
 * Prioriza match exacto de carrera; si solo hay área, deja carrera null.
 */
export function resolveNotasCarreraArea(
  carreraNombre: string | null | undefined,
  areaCodigo: string | null | undefined,
  areas: NotasArea[],
  carreras: NotasCarrera[],
): { areaId: number | null; carreraId: number | null } {
  const carreraTxt = carreraNombre?.trim() ? fold(carreraNombre) : '';
  const areaTxt = areaCodigo?.trim() ? fold(areaCodigo) : '';

  let areaId: number | null = null;
  let carreraId: number | null = null;

  if (carreraTxt) {
    const ranked = carreras
      .map((c) => {
        const n = fold(c.nombre);
        let score = 0;
        if (n === carreraTxt) score = 100;
        else if (n.includes(carreraTxt) || carreraTxt.includes(n)) score = 70;
        else if (n.split(' ').some((w) => w.length > 3 && carreraTxt.includes(w))) score = 40;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.c.nombre.length - b.c.nombre.length);

    if (ranked[0]) {
      carreraId = ranked[0].c.id;
      areaId = ranked[0].c.areaId;
    }
  }

  if (areaId == null && areaTxt) {
    const ranked = areas
      .map((a) => {
        const codigo = fold(a.codigo);
        const nombre = fold(a.nombre);
        let score = 0;
        if (codigo === areaTxt || nombre === areaTxt) score = 100;
        else if (nombre.includes(areaTxt) || areaTxt.includes(codigo)) score = 70;
        return { a, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked[0]) areaId = ranked[0].a.id;
  }

  if (carreraId != null && areaId != null) {
    const car = carreras.find((c) => c.id === carreraId);
    if (car && car.areaId !== areaId) {
      // Preferir el área de la carrera resuelta
      areaId = car.areaId;
    }
  }

  return { areaId, carreraId };
}

export function areaShortLabel(area: NotasArea): string {
  if (area.codigo === 'salud') return 'Salud';
  if (area.codigo === 'ingenierias') return 'Ingenierías';
  if (area.codigo === 'letras') return 'Letras';
  return area.nombre;
}
