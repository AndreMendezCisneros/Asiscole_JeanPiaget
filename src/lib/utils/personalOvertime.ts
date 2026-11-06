import type { Personal, PersonalArrivalRecord, PersonalTallerRecord } from '@/types/personal';
import { minutesOf, scheduleForDate } from './personalSchedule';

export type OvertimeKind = 'salida tarde' | 'taller' | 'día sin horario';

export interface OvertimeItem {
  date: string;
  kind: OvertimeKind;
  minutes: number;
  detail: string;
}

export interface OvertimeSummary {
  personal: Personal;
  totalMin: number;
  afterExitMin: number;
  tallerMin: number;
  offDayMin: number;
  /** Días pasados con entrada de taller o de día sin horario, pero sin salida (cuentan 0). */
  missingDepartureDays: number;
  /** Días que marcó salida de clase, pero su horario no tiene hora de salida. */
  daysWithoutExit: number;
  items: OvertimeItem[];
}

function overlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

/**
 * Horas extra por empleado:
 * - salida tarde: hora en que salió − hora de salida (llegar antes no cuenta);
 * - día sin horario: salida − entrada;
 * - taller: salida − entrada, sin contar lo que cae dentro de su horario del día.
 * Sin salida marcada no se calcula: se cuenta el día para que RR.HH. lo revise.
 */
export function computeOvertime(
  personal: Personal[],
  records: PersonalArrivalRecord[],
  talleres: PersonalTallerRecord[],
  today: string,
): OvertimeSummary[] {
  return personal.map((p) => {
    const s: OvertimeSummary = {
      personal: p,
      totalMin: 0,
      afterExitMin: 0,
      tallerMin: 0,
      offDayMin: 0,
      missingDepartureDays: 0,
      daysWithoutExit: 0,
      items: [],
    };
    const own = records.filter((r) => r.personalId === p.id);
    const byDate = new Map(own.map((r) => [r.date, r]));
    const missing = new Set<string>();

    for (const r of own) {
      if (!r.arrivalTime) continue;
      if (r.status === 'Fuera de horario') {
        if (!r.departureTime) {
          if (r.date < today) missing.add(r.date);
          continue;
        }
        const minutes = Math.max(0, minutesOf(r.departureTime) - minutesOf(r.arrivalTime));
        s.offDayMin += minutes;
        s.items.push({
          date: r.date,
          kind: 'día sin horario',
          minutes,
          detail: `Entró ${r.arrivalTime}, salió ${r.departureTime}`,
        });
        continue;
      }
      if (r.status === 'Falta' || r.status === 'Falta justificada' || !r.departureTime) continue;
      const exit = r.expectedExit ?? scheduleForDate(p.schedule, r.date)?.exit ?? null;
      if (!exit) {
        s.daysWithoutExit++;
        continue;
      }
      const minutes = minutesOf(r.departureTime) - minutesOf(exit);
      if (minutes > 0) {
        s.afterExitMin += minutes;
        s.items.push({
          date: r.date,
          kind: 'salida tarde',
          minutes,
          detail: `Salida ${exit}, salió ${r.departureTime}`,
        });
      }
    }

    for (const t of talleres) {
      if (t.personalId !== p.id) continue;
      if (!t.departureTime) {
        if (t.date < today) missing.add(t.date);
        continue;
      }
      const start = minutesOf(t.arrivalTime);
      const end = minutesOf(t.departureTime);
      const record = byDate.get(t.date);
      const horario = scheduleForDate(p.schedule, t.date);
      const entry = record?.expectedEntry ?? horario?.entry ?? null;
      const exit = record?.expectedExit ?? horario?.exit ?? null;
      const inside = entry && exit ? overlap(start, end, minutesOf(entry), minutesOf(exit)) : 0;
      const minutes = Math.max(0, end - start - inside);
      s.tallerMin += minutes;
      s.items.push({
        date: t.date,
        kind: 'taller',
        minutes,
        detail: `Taller ${t.arrivalTime}–${t.departureTime}${inside > 0 ? ' (solo cuenta lo que está fuera de su horario)' : ''}`,
      });
    }

    s.missingDepartureDays = missing.size;
    s.totalMin = s.afterExitMin + s.tallerMin + s.offDayMin;
    s.items.sort((a, b) => b.date.localeCompare(a.date));
    return s;
  });
}
