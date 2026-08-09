/** Normaliza nombres de personas para matching (DNI/Excel ↔ nómina). */
export function normalizePersonName(name: string | null | undefined): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/,/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
