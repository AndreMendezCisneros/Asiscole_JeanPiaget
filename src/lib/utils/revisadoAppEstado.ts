export type RevisadoAppEstado = 'no' | 'visto' | 'confirmado';

export function revisadoAppEstado(incident: {
  revisadoApp?: boolean;
  confirmadaApp?: boolean;
}): RevisadoAppEstado {
  if (incident.confirmadaApp) return 'confirmado';
  if (incident.revisadoApp) return 'visto';
  return 'no';
}
