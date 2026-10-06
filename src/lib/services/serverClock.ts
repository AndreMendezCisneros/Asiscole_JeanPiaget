import { supabase } from '../supabaseClient';
import { getLimaNow } from '@/lib/utils/limaDateTime';

export type LimaClock = {
  date: string;
  time: string;
};

type CachedClock = LimaClock & {
  fetchedAt: number;
  /** Diferencia (ms) aprox. entre reloj Lima del servidor y Date.now() del cliente. */
  offsetMs: number;
};

const CACHE_TTL_MS = 20_000;
let cache: CachedClock | null = null;
let inFlight: Promise<LimaClock> | null = null;

function parseClockPayload(data: unknown): LimaClock {
  const row = Array.isArray(data) ? data[0] : data;
  const date = String((row as { fecha?: string } | null)?.fecha ?? '').slice(0, 10);
  const time = String((row as { hora?: string } | null)?.hora ?? '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error('El reloj del servidor no devolvió fecha y hora.');
  }
  return { date, time };
}

function limaInstantFromParts(date: string, time: string): number {
  return new Date(`${date}T${time}:00-05:00`).getTime();
}

function clockFromOffset(offsetMs: number, at = Date.now()): LimaClock {
  const limaMs = at + offsetMs;
  const d = new Date(limaMs);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/**
 * Fecha y hora de Lima según Postgres (`sie_reloj_lima`).
 * Con caché corta: el escáner no paga un RPC en cada carnet.
 */
export async function fetchServerLimaClock(options?: { force?: boolean }): Promise<LimaClock> {
  const force = options?.force === true;
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return clockFromOffset(cache.offsetMs, now);
  }

  if (!force && inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase.rpc('sie_reloj_lima');
    if (error) {
      throw new Error(
        'No se pudo leer la hora del servidor. Ejecute sql/migraciones/RELOJ_LIMA_SERVIDOR.sql',
      );
    }
    const clock = parseClockPayload(data);
    const fetchedAt = Date.now();
    const offsetMs = limaInstantFromParts(clock.date, clock.time) - fetchedAt;
    cache = { ...clock, fetchedAt, offsetMs };
    return clockFromOffset(offsetMs, fetchedAt);
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Reloj inmediato: caché/offset si hay; si no, Lima local (mientras se sincroniza). */
export function getLimaClockFast(): LimaClock {
  if (cache) return clockFromOffset(cache.offsetMs);
  return getLimaNow();
}

/** Mantiene la caché caliente (llamar al abrir el escáner). */
export function startLimaClockSync(intervalMs = 15_000): () => void {
  void fetchServerLimaClock().catch(() => {
    /* silencioso */
  });
  const id = window.setInterval(() => {
    void fetchServerLimaClock({ force: true }).catch(() => {
      /* silencioso */
    });
  }, intervalMs);
  return () => window.clearInterval(id);
}
