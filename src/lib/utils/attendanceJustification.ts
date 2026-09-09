import type { AttendanceStatus } from '@/types';

export const ARRIVAL_ESTADO = {
  ON_TIME: 'A tiempo',
  LATE: 'Tarde',
  LATE_JUSTIFIED: 'Tarde justificada',
  ABSENCE_JUSTIFIED: 'Falta justificada',
} as const;

export const MIN_JUSTIFICATION_REASON_LENGTH = 10;

/** Desde esta fecha, un día hábil cerrado sin llegada cuenta como falto. */
export const ABSENCE_INFERENCE_START = '2026-09-07';

export function isProtectedArrivalStatus(status: string | null | undefined): boolean {
  return (
    status === ARRIVAL_ESTADO.LATE_JUSTIFIED ||
    status === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED ||
    status === 'Falta' ||
    status === 'Injustificada'
  );
}

export function isCountableArrivalStatus(status?: string | null): boolean {
  return (
    status === ARRIVAL_ESTADO.ON_TIME ||
    status === ARRIVAL_ESTADO.LATE ||
    status === ARRIVAL_ESTADO.LATE_JUSTIFIED ||
    status === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED ||
    status === 'Justificada'
  );
}

export function isRawAbsenceStatus(status?: string | null): boolean {
  return status === 'Falta' || status === 'Injustificada';
}

function weekdayFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekdayDateKey(dateKey: string): boolean {
  const dow = weekdayFromDateKey(dateKey);
  return dow >= 1 && dow <= 5;
}

/** Día hábil ya cerrado desde el cutoff: puede inferirse falto. */
export function isClosedFaltoEligibleDate(dateKey: string, todayKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  if (!isWeekdayDateKey(dateKey)) return false;
  if (dateKey < ABSENCE_INFERENCE_START) return false;
  return dateKey < todayKey;
}

export function arrivalDateKey(fecha: string | Date | null | undefined): string {
  if (!fecha) return '';
  const raw = fecha instanceof Date ? fecha.toISOString() : String(fecha).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

export function studentRecordId(id: number | string | null | undefined): number {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function hasUsableArrivalTime(arrivalTime?: string | null): boolean {
  const t = (arrivalTime ?? '').trim();
  return t.length > 0 && !/^00:00/.test(t);
}

/** 00:00 / vacío no es escaneo: salvo justificados, se trata como falto. */
export function collapsePlaceholderArrivalStatus(
  status?: string | null,
  arrivalTime?: string | null,
): string {
  if (hasUsableArrivalTime(arrivalTime)) return status ?? 'Falta';
  if (status === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED || status === ARRIVAL_ESTADO.LATE_JUSTIFIED) {
    return status;
  }
  return 'Falta';
}

/** Planilla: falto solo si el día cerró y no hay fila de llegada. */
export function resolveReportStatusForDay(
  dateKey: string,
  rawEstado: string | null | undefined,
  todayKey: string,
  options?: { hasRecord?: boolean; arrivalTime?: string | null },
): AttendanceStatus {
  const mapped = convertArrivalEstadoToReport(rawEstado);
  const arrived = hasUsableArrivalTime(options?.arrivalTime);
  // Falta legado + hora real = sí asistió.
  if (mapped === 'Injustificada' && arrived) return 'A_tiempo';
  if (mapped !== 'Sin_registro') return mapped;
  if (options?.hasRecord || arrived) {
    return arrived ? 'A_tiempo' : 'Sin_registro';
  }
  if (isClosedFaltoEligibleDate(dateKey, todayKey)) return 'Injustificada';
  return 'Sin_registro';
}

export function convertArrivalEstadoToReport(status?: string | null): AttendanceStatus {
  if (!status) return 'Sin_registro';
  const normalized = status.trim();
  if (normalized === ARRIVAL_ESTADO.ON_TIME) return 'A_tiempo';
  if (normalized === ARRIVAL_ESTADO.LATE) return 'Tarde';
  if (normalized === ARRIVAL_ESTADO.LATE_JUSTIFIED || normalized === 'Justificada') return 'Tarde_justificada';
  if (normalized === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED) return 'Inasistencia_justificada';
  if (normalized === 'Falta' || normalized === 'Injustificada') return 'Injustificada';
  return 'Sin_registro';
}

export type AttendanceTotals = {
  onTime: number;
  late: number;
  lateJustified: number;
  absentJustified: number;
  justified: number;
  unjustified: number;
};

export function emptyAttendanceTotals(): AttendanceTotals {
  return {
    onTime: 0,
    late: 0,
    lateJustified: 0,
    absentJustified: 0,
    justified: 0,
    unjustified: 0,
  };
}

export function tallyAttendanceStatus(totals: AttendanceTotals, status: AttendanceStatus): void {
  switch (status) {
    case 'A_tiempo':
      totals.onTime += 1;
      break;
    case 'Tarde':
      totals.late += 1;
      break;
    case 'Tarde_justificada':
    case 'Justificada':
      totals.lateJustified += 1;
      totals.justified += 1;
      break;
    case 'Inasistencia_justificada':
      totals.absentJustified += 1;
      break;
    case 'Injustificada':
      totals.unjustified += 1;
      break;
  }
}
