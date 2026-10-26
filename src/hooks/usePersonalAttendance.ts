import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

/**
 * Carga el personal activo y sus registros en un rango de fechas.
 * Pocas decenas de empleados: se trae todo y se filtra en el cliente.
 */
export function usePersonalAttendance(from: string, to: string) {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [records, setRecords] = useState<PersonalArrivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      const [staff, regs] = await Promise.all([
        personalService.getAll({ active: true }),
        personalAttendanceService.getRecords({ from, to }),
      ]);
      if (staff.error) toast.error(staff.error);
      if (regs.error) toast.error(regs.error);
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

  return { personal, records, loading, refreshing, reload: load };
}
