import { describe, expect, it } from 'vitest';
import { getBimestreDates } from './bimestreUtils';

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('getBimestreDates', () => {
  it('los cuatro bimestres quedan dentro del mismo año escolar', () => {
    const ranges = ([1, 2, 3, 4] as const).map((b) => {
      const { inicio, fin } = getBimestreDates(b, 2026);
      return [key(inicio), key(fin)];
    });
    expect(ranges).toEqual([
      ['2026-03-01', '2026-05-31'],
      ['2026-06-01', '2026-07-31'],
      ['2026-08-01', '2026-10-31'],
      ['2026-11-01', '2026-12-31'],
    ]);
  });
});
