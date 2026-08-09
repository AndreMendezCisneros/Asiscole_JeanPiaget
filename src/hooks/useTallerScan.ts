import { useCallback, useState } from 'react';
import { isTalleresEnabled } from '@/config/features';
import { tallerAttendanceService, whatsappService } from '@/lib/services';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import type { ArrivalRecord, Student, TallerAsistencia } from '@/types';

export type ScanMode = 'clase' | 'taller';
/** En clase y talleres el tutor elige Llegada o Salida (como Control de Llegadas / Salidas). */
export type TallerPhase = 'llegada' | 'salida';
/** Misma semántica que talleres; alias explícito para modo clase. */
export type ClasePhase = TallerPhase;
export type TallerScanAction = 'arrival' | 'departure' | 'complete';

const TALLER_NOTIFY = { tallerId: 'taller', tallerNombre: 'Taller' } as const;

type TallerScanSuccess = {
  ok: true;
  action: 'arrival' | 'departure';
  record: ArrivalRecord;
  displayStatus: string;
  displayTime: string;
  statusForTotals: ArrivalRecord['status'] | null;
};

type TallerScanFailure = {
  ok: false;
  error: string;
};

export type TallerScanResult = TallerScanSuccess | TallerScanFailure;

function mapTallerRecordToArrivalRecord(record: TallerAsistencia): ArrivalRecord {
  return {
    id: record.id,
    studentId: record.studentId,
    date: record.date,
    arrivalTime: record.arrivalTime ?? '00:00',
    status: 'A tiempo',
    registeredBy: record.registeredBy,
    createdAt: record.date,
    departureTime: record.departureTime,
    departureType: record.departureType,
  };
}

function getYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map((part) => Number(part));
  return { year, month };
}

export function findTodayTallerAttendance(
  records: TallerAsistencia[],
  date: string,
): TallerAsistencia | null {
  return records.find((record) => record.date === date) ?? null;
}

export function resolveTallerScanAction(
  record: Pick<TallerAsistencia, 'arrivalTime' | 'departureTime'> | null | undefined,
): TallerScanAction {
  if (!record?.arrivalTime) return 'arrival';
  if (!record.departureTime) return 'departure';
  return 'complete';
}

export function useTallerScan() {
  const talleresEnabled = isTalleresEnabled();
  const [scanMode, setScanMode] = useState<ScanMode>('clase');
  const [tallerPhase, setTallerPhase] = useState<TallerPhase>('llegada');
  const [clasePhase, setClasePhase] = useState<ClasePhase>('llegada');

  const isTallerMode = talleresEnabled && scanMode === 'taller';

  const handleSetScanMode = useCallback((mode: ScanMode) => {
    setScanMode(mode);
    if (mode === 'taller') {
      setTallerPhase('llegada');
    } else {
      setClasePhase('llegada');
    }
  }, []);

  const handleTallerScan = useCallback(
    async (student: Student, registeredBy?: number): Promise<TallerScanResult> => {
      if (!talleresEnabled || scanMode !== 'taller') {
        return { ok: false, error: 'El modo Talleres no está activo.' };
      }
      if (!registeredBy) {
        return { ok: false, error: 'Usuario no autenticado' };
      }

      const today = getLimaTodayDate();
      const { year, month } = getYearMonth(today);
      const { records, error: recordsError } = await tallerAttendanceService.fetchMonthForStudent(
        student.id,
        year,
        month,
      );
      if (recordsError) {
        return { ok: false, error: recordsError };
      }

      const todayRecord = findTodayTallerAttendance(records, today);
      const state = resolveTallerScanAction(todayRecord);

      if (tallerPhase === 'salida') {
        if (state === 'arrival') {
          return {
            ok: false,
            error: `${student.fullName} aún no tiene llegada a taller. Cambie a Llegada y escanee primero.`,
          };
        }
        if (state === 'complete') {
          return {
            ok: false,
            error: `${student.fullName} ya tiene salida de taller registrada hoy.`,
          };
        }

        const { success, error, departureTime, record: updated } =
          await tallerAttendanceService.recordDeparture(student.id, registeredBy, today);

        if (!success || !departureTime || !updated) {
          return { ok: false, error: error || 'No se pudo registrar la salida del taller.' };
        }

        const record = mapTallerRecordToArrivalRecord(updated);

        if (whatsappService.isEnabled()) {
          void whatsappService.notifyParentDeparture(student, record, TALLER_NOTIFY);
        }

        return {
          ok: true,
          action: 'departure',
          record,
          displayStatus: 'Salió del taller',
          displayTime: departureTime,
          statusForTotals: null,
        };
      }

      // Fase llegada
      if (state !== 'arrival') {
        return {
          ok: false,
          error: `${student.fullName} ya tiene llegada de taller hoy${
            todayRecord?.arrivalTime ? ` (${todayRecord.arrivalTime})` : ''
          }. Para salida, elija Salida.`,
        };
      }

      const { record: arrivalRecord, error: arrivalError } = await tallerAttendanceService.recordArrival(
        undefined,
        student.id,
        registeredBy,
      );

      if (arrivalError || !arrivalRecord) {
        return { ok: false, error: arrivalError || 'No se pudo registrar la llegada del taller.' };
      }

      const record = mapTallerRecordToArrivalRecord(arrivalRecord);
      const displayTime = arrivalRecord.arrivalTime ?? '—:—';

      if (whatsappService.isEnabled()) {
        void whatsappService.notifyParentArrival(student, record, TALLER_NOTIFY);
      }

      return {
        ok: true,
        action: 'arrival',
        record,
        displayStatus: 'Llegó a taller',
        displayTime,
        statusForTotals: null,
      };
    },
    [scanMode, tallerPhase, talleresEnabled],
  );

  return {
    handleTallerScan,
    isTallerMode,
    scanMode,
    setScanMode: handleSetScanMode,
    tallerPhase,
    setTallerPhase,
    clasePhase,
    setClasePhase,
    talleresEnabled,
  };
}
