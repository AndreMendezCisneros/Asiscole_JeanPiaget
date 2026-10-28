import { describe, expect, it } from 'vitest';
import { layoutOverlappingEvents } from './eventLayout';

const ev = (id: number, start: string, end: string) => ({ id, start: `2026-10-29T${start}:00`, end: `2026-10-29T${end}:00` });

describe('layoutOverlappingEvents', () => {
  it('cita masiva: 5 citas a la misma hora quedan en 5 columnas', () => {
    const m = layoutOverlappingEvents([31, 32, 33, 34, 35].map((id) => ev(id, '13:00', '13:30')));
    expect([...m.values()].map((s) => s.lane).sort()).toEqual([0, 1, 2, 3, 4]);
    expect([...m.values()].every((s) => s.lanes === 5)).toBe(true);
  });

  it('eventos que no se cruzan ocupan todo el ancho', () => {
    const m = layoutOverlappingEvents([ev(1, '08:00', '08:30'), ev(2, '09:00', '09:30')]);
    expect(m.get(1)).toEqual({ lane: 0, lanes: 1 });
    expect(m.get(2)).toEqual({ lane: 0, lanes: 1 });
  });

  it('reutiliza la columna libre dentro del grupo', () => {
    const m = layoutOverlappingEvents([ev(1, '08:00', '09:00'), ev(2, '08:15', '08:30'), ev(3, '08:40', '08:50')]);
    expect(m.get(1)?.lane).toBe(0);
    expect(m.get(2)?.lane).toBe(1);
    expect(m.get(3)?.lane).toBe(1);
    expect(m.get(3)?.lanes).toBe(2);
  });
});

import { groupSameSlot } from './eventLayout';

describe('groupSameSlot', () => {
  it('une la cita masiva en un bloque y deja aparte otra cita a la misma hora', () => {
    const base = { start: '2026-10-29T13:00:00', end: '2026-10-29T13:30:00' };
    const groups = groupSameSlot([
      ...[1, 2, 3, 4, 5].map((id) => ({ id, title: 'Incidente en aula', ...base })),
      { id: 6, title: 'Tardanzas', ...base },
    ]);
    expect(groups.map((g) => g.items.length).sort()).toEqual([1, 5]);
    expect(layoutOverlappingEvents(groups).get(groups[0].id)?.lanes).toBe(2);
  });
});
