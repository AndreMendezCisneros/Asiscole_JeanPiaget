/**
 * Reparte en columnas los eventos que se cruzan en el tiempo, para que no se tapen
 * (citas masivas: varios estudiantes a la misma hora).
 */
export interface LaidOutSlot {
  /** Columna del evento (0 = izquierda). */
  lane: number;
  /** Columnas del grupo de eventos que se cruzan con él. */
  lanes: number;
}

export function layoutOverlappingEvents<T extends { id: string | number; start: Date | string; end: Date | string }>(
  events: T[],
): Map<T['id'], LaidOutSlot> {
  const items = events
    .map((e) => ({ id: e.id, start: new Date(e.start).getTime(), end: new Date(e.end).getTime() }))
    .map((e) => ({ ...e, end: Math.max(e.end, e.start + 1) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const result = new Map<T['id'], LaidOutSlot>();
  let cluster: { id: T['id']; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const e of items) {
    if (e.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.end);
    } else {
      laneEnds[lane] = e.end;
    }
    cluster.push({ id: e.id, lane });
    clusterEnd = Math.max(clusterEnd === -Infinity ? e.end : clusterEnd, e.end);
  }
  flush();
  return result;
}

/** Estilo left/width de un evento según su columna. */
export function laneStyle(slot: LaidOutSlot | undefined, gapPx = 2): { left: string; width: string } {
  const lanes = slot?.lanes ?? 1;
  const lane = slot?.lane ?? 0;
  return {
    left: `calc(${(lane / lanes) * 100}% + ${gapPx}px)`,
    width: `calc(${100 / lanes}% - ${gapPx * 2}px)`,
  };
}

/** Citas con el mismo título y la misma hora de inicio forman un bloque (cita masiva). */
export interface EventGroup<T> {
  id: string;
  start: Date;
  end: Date;
  items: T[];
}

export function groupSameSlot<T extends { title: string; start: Date | string; end: Date | string }>(events: T[]): EventGroup<T>[] {
  const map = new Map<string, EventGroup<T>>();
  for (const e of events) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const key = `${e.title}|${start.getTime()}`;
    const g = map.get(key);
    if (g) {
      g.items.push(e);
      if (end > g.end) g.end = end;
    } else {
      map.set(key, { id: key, start, end, items: [e] });
    }
  }
  return [...map.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
