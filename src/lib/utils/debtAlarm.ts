/** Umbral: faltas > 3 ⇒ ≥ 4 inasistencias "Falta". */
export const DEBT_FALTA_THRESHOLD = 4;

/** Umbral: ≥ 4 "No porta carnet institucional". */
export const DEBT_CARNET_THRESHOLD = 4;

/** Umbral colegio: ≥ 3 tardanzas (estado "Tarde"). */
export const DEBT_TARDE_THRESHOLD = 3;

/** Solo local / flag explícito — no activar en build de producción. */
export function isDebtAlarmEnabled(): boolean {
  if (import.meta.env.VITE_DEBT_ALARM_LOCAL === 'true') return true;
  return Boolean(import.meta.env.DEV);
}

/** Normaliza nombre de falta para comparar (minúsculas, sin acentos). */
export function normalizeFaultName(name: string | null | undefined): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inasistenciaencias que disparan deuda:
 * - "Falta" (exacto)
 * - "Falta académica" (lo que registra el staff en JP)
 */
export function isFaltaInasistenciaName(name: string | null | undefined): boolean {
  const n = normalizeFaultName(name);
  return n === 'falta' || n === 'falta academica';
}

/** Catálogo id 10 / variantes: "No porta carné/carnet institucional". */
export function isCarnetFaultName(name: string | null | undefined): boolean {
  const n = normalizeFaultName(name);
  // "carné" (NFD) → "carne"; también aceptamos "carnet" sin acento.
  return (
    n.includes('no porta carnet institucional') ||
    n.includes('no porta carne institucional')
  );
}

export function shouldAlertDebtFromCounts(counts: {
  faltaCount: number;
  carnetCount: number;
  tardeCount?: number;
}): { alertFalta: boolean; alertCarnet: boolean; alertTarde: boolean } {
  return {
    alertFalta: counts.faltaCount >= DEBT_FALTA_THRESHOLD,
    alertCarnet: counts.carnetCount >= DEBT_CARNET_THRESHOLD,
    alertTarde: (counts.tardeCount ?? 0) >= DEBT_TARDE_THRESHOLD,
  };
}

/**
 * Tras registrar una incidencia: ¿el nuevo conteo acaba de cruzar el umbral?
 * `counts` debe incluir ya la incidencia recién creada.
 */
export function shouldAlertDebtAfterIncident(opts: {
  faultName: string | null | undefined;
  faltaCount: number;
  carnetCount: number;
  tardeCount?: number;
}): { alertFalta: boolean; alertCarnet: boolean; alertTarde: boolean } {
  const isFalta = isFaltaInasistenciaName(opts.faultName);
  const isCarnet = isCarnetFaultName(opts.faultName);
  const prevFalta = isFalta ? opts.faltaCount - 1 : opts.faltaCount;
  const prevCarnet = isCarnet ? opts.carnetCount - 1 : opts.carnetCount;
  return {
    alertFalta:
      isFalta &&
      prevFalta < DEBT_FALTA_THRESHOLD &&
      opts.faltaCount >= DEBT_FALTA_THRESHOLD,
    alertCarnet:
      isCarnet &&
      prevCarnet < DEBT_CARNET_THRESHOLD &&
      opts.carnetCount >= DEBT_CARNET_THRESHOLD,
    // Las tardanzas no se crean como incidencia de catálogo aquí.
    alertTarde: false,
  };
}
