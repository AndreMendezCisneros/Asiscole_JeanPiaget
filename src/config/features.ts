/** JP: activo por defecto. Solo se apaga con VITE_*=false. */
function envFlagDefaultOn(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === '') return true;
  return raw === 'true';
}

export function parseTalleresEnabled(raw: string | undefined): boolean {
  return envFlagDefaultOn(raw);
}

export function isTalleresEnabled(): boolean {
  return parseTalleresEnabled(import.meta.env.VITE_TALLERES_ENABLED);
}

export function parsePensionesEnabled(raw: string | undefined): boolean {
  return envFlagDefaultOn(raw);
}

export function isPensionesEnabled(): boolean {
  return parsePensionesEnabled(import.meta.env.VITE_PENSIONES_ENABLED);
}
