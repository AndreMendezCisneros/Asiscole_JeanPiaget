import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { configService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { DEFAULT_ABSENCE_AFTER_MIN } from '@/lib/utils/personalSchedule';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

/** Clave en configuracion_sistema: minutos sin marcar tras su entrada → inasistencia. */
export const ABSENCE_AFTER_KEY = 'personal_minutos_inasistencia';

/**
 * Carga el personal activo y sus registros en un rango de fechas, más el
 * margen de inasistencia configurado. Pocas decenas de empleados: se trae
 * todo y se filtra en el cliente.
 */
export function usePersonalAttendance(from: string, to: string) {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [records, setRecords] = useState<PersonalArrivalRecord[]>([]);
  const [absenceAfterMin, setAbsenceAfterMin] = useState(DEFAULT_ABSENCE_AFTER_MIN);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const [staff, regs, cfg] = await Promise.all([
        personalService.getAll({ active: true }),
        personalAttendanceService.getRecords({ from, to }),
        configService.getByKeys([ABSENCE_AFTER_KEY]),
      ]);
      if (staff.error) toast.error(staff.error);
      if (regs.error) toast.error(regs.error);
      const minutes = Number.parseInt(cfg.configs[ABSENCE_AFTER_KEY]?.value ?? '', 10);
      setAbsenceAfterMin(Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_ABSENCE_AFTER_MIN);
      setPersonal(staff.personal);
      setRecords(regs.records);
      setLoading(false);
      setRefreshing(false);
    },
    [from, to],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { personal, records, absenceAfterMin, loading, refreshing, reload: load };
}
