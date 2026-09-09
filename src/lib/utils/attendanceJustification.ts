import type { AttendanceStatus } from '@/types';

export const ARRIVAL_ESTADO = {
  ON_TIME: 'A tiempo',
  LATE: 'Tarde',
  LATE_JUSTIFIED: 'Tarde justificada',
  ABSENCE_JUSTIFIED: 'Falta justificada',
} as const;

export const MIN_JUSTIFICATION_REASON_LENGTH = 10;

export function isProtectedArrivalStatus(status: string | null | undefined): boolean {
  return (
    status === ARRIVAL_ESTADO.LATE_JUSTIFIED ||
    status === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED ||
    status === 'Falta'
  );
}

export function convertArrivalEstadoToReport(status?: string | null): AttendanceStatus {
  if (!status) return 'Sin_registro';
  if (status === ARRIVAL_ESTADO.ON_TIME) return 'A_tiempo';
  if (status === ARRIVAL_ESTADO.LATE) return 'Tarde';
  if (status === ARRIVAL_ESTADO.LATE_JUSTIFIED || status === 'Justificada') return 'Tarde_justificada';
  if (status === ARRIVAL_ESTADO.ABSENCE_JUSTIFIED) return 'Inasistencia_justificada';
  if (status === 'Falta' || status === 'Injustificada') return 'Injustificada';
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
