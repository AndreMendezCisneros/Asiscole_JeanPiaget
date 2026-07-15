/**
 * Límites por chip (anti-baneo). Formato env:
 *   WPPCONNECT_CHIP_HOURLY_LIMITS=sie-chip-04=2,sie-chip-05=50
 */
export function parseChipLimits(envValue, defaultLimit) {
  const limits = new Map();
  if (!envValue?.trim()) return limits;

  for (const part of envValue.split(',')) {
    const [session, rawLimit] = part.split('=').map((s) => s.trim());
    const limit = Number(rawLimit);
    if (session && Number.isFinite(limit) && limit >= 0) {
      limits.set(session, Math.floor(limit));
    }
  }
  return limits;
}

export function maxSendsForSession(session, limits, defaultLimit) {
  if (limits.has(session)) return limits.get(session);
  return defaultLimit;
}

export function parseSessionList(envValue, fallback) {
  return (envValue || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
