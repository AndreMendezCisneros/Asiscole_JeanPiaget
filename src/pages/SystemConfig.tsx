import { Settings, Clock, CalendarRange } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaffKpiStat } from '@/components/staff';
import { AttendanceSettingsCard } from '@/components/system-config/AttendanceSettingsCard';
import { ReincidenceSettingsCard } from '@/components/system-config/ReincidenceSettingsCard';
import { SYSTEM_SETTINGS } from '@/config/systemSettings';

export const SystemConfig = () => {
  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={Settings}
        eyebrow="Administración"
        title="Configuración del Sistema"
        description="Horarios de asistencia y reglas de reincidencia que aplican a todo el colegio"
        accent="secondary"
      />

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-2">
        <StaffKpiStat
          label="Horarios de asistencia"
          value={SYSTEM_SETTINGS.length}
          hint="Parámetros de puntualidad"
          icon={Clock}
          tone="info"
        />
        <StaffKpiStat
          label="Niveles de reincidencia"
          value={6}
          hint="Escala de comportamiento 0–5"
          icon={CalendarRange}
          tone="warning"
        />
      </div>

      <AttendanceSettingsCard />
      <ReincidenceSettingsCard />
    </div>
  );
};
