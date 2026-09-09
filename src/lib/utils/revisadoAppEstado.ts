export type RevisadoAppEstado = 'no' | 'visto' | 'confirmado';

export function revisadoAppEstado(incident: {
  revisadoApp?: boolean;
  confirmadaApp?: boolean;
}): RevisadoAppEstado {
  if (incident.confirmadaApp) return 'confirmado';
  if (incident.revisadoApp) return 'visto';
  return 'no';
}

/** Equivalente en cliente de los filtros `revisado` de `/incidents`. */
export function incidentMatchesRevisadoFilter(
  incident: { revisadoApp?: boolean; confirmadaApp?: boolean },
  filter?: RevisadoAppEstado | 'all',
): boolean {
  if (!filter || filter === 'all') return true;
  return revisadoAppEstado(incident) === filter;
}
