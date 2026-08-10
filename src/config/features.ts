export function parseTalleresEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function isTalleresEnabled(): boolean {
  return parseTalleresEnabled(import.meta.env.VITE_TALLERES_ENABLED);
}

export function parsePensionesEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function isPensionesEnabled(): boolean {
  return parsePensionesEnabled(import.meta.env.VITE_PENSIONES_ENABLED);
}

export function parseNotasEnabled(raw: string | undefined): boolean {
  return raw === 'true';
}

export function isNotasEnabled(): boolean {
  return parseNotasEnabled(import.meta.env.VITE_NOTAS_ENABLED);
}
