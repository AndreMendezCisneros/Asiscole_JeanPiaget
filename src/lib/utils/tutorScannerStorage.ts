import type { ArrivalRecord, Student } from '@/types';

/**
 * Persistencia local del scanner del tutor:
 *   - Caché de llegadas del día (evita re-consultas y falsos "sin llegada" al recargar).
 *   - Cola offline de escaneos pendientes de guardar en Supabase.
 *
 * Todo está scoping por fecha (YYYY-MM-DD) para autolimpiarse cada mañana.
 * Los errores de storage son silenciosos: el scanner funciona igual sin persistencia.
 */

const TODAY_ARRIVALS_KEY_PREFIX = 'sie:tutor:today-arrivals:';
const PENDING_QUEUE_KEY = 'sie:tutor:pending-arrivals';
const PENDING_QUEUE_MAX = 100;

export type PendingScan = {
  /** id único para deduplicar reintentos */
  id: string;
  studentId: number;
  studentSnapshot: Pick<Student, 'id' | 'fullName' | 'grade' | 'section' | 'level' | 'barcode' | 'profilePhoto'>;
  date: string;
  arrivalTime: string;
  studentLevel: string | null;
  registeredBy: number | null;
  /** Momento del escaneo (para orden y expiración) */
  createdAt: number;
  attempts: number;
};

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Caché de llegadas del día                                                 */
/* -------------------------------------------------------------------------- */

function keyForDate(date: string): string {
  return `${TODAY_ARRIVALS_KEY_PREFIX}${date}`;
}

/** Limpia entradas de días anteriores para no acumular basura. */
function pruneOldArrivalCaches(currentDate: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i);
      if (!k || !k.startsWith(TODAY_ARRIVALS_KEY_PREFIX)) continue;
      if (k !== keyForDate(currentDate)) storage.removeItem(k);
    }
  } catch {
    /* silencioso */
  }
}

export function loadTodayArrivals(date: string): Map<number, ArrivalRecord> {
  const storage = safeStorage();
  if (!storage) return new Map();
  try {
    pruneOldArrivalCaches(date);
    const raw = storage.getItem(keyForDate(date));
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as Array<[number, ArrivalRecord]>;
    if (!Array.isArray(entries)) return new Map();
    return new Map(entries);
  } catch {
    return new Map();
  }
}

export function saveTodayArrivals(
  date: string,
  arrivals: Map<number, ArrivalRecord>,
): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const entries = [...arrivals.entries()];
    storage.setItem(keyForDate(date), JSON.stringify(entries));
  } catch {
    /* cuota llena → ignorar */
  }
}

/* -------------------------------------------------------------------------- */
/*  Cola offline                                                              */
/* -------------------------------------------------------------------------- */

export function loadPendingScans(): PendingScan[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingScan[];
    if (!Array.isArray(list)) return [];
    return list;
  } catch {
    return [];
  }
}

export function savePendingScans(list: PendingScan[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    // Recortar a los más recientes para no reventar la cuota.
    const trimmed = list.slice(-PENDING_QUEUE_MAX);
    storage.setItem(PENDING_QUEUE_KEY, JSON.stringify(trimmed));
  } catch {
    /* silencioso */
  }
}

export function enqueuePendingScan(scan: PendingScan): PendingScan[] {
  const list = loadPendingScans();
  // Dedup por (studentId, date): reemplaza si existía uno con la misma clave.
  const filtered = list.filter(
    (item) => !(item.studentId === scan.studentId && item.date === scan.date),
  );
  filtered.push(scan);
  savePendingScans(filtered);
  return filtered;
}

export function removePendingScan(id: string): PendingScan[] {
  const list = loadPendingScans().filter((item) => item.id !== id);
  savePendingScans(list);
  return list;
}

export function updatePendingScan(id: string, patch: Partial<PendingScan>): PendingScan[] {
  const list = loadPendingScans().map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
  savePendingScans(list);
  return list;
}
