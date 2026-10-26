import { Settings, Clock, CalendarRange } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StaffKpiStat } from '@/components/staff';
import { AttendanceSettingsCard } from '@/components/system-config/AttendanceSettingsCard';
import { ReincidenceSettingsCard } from '@/components/system-config/ReincidenceSettingsCard';
import { PensionesSettingsCard } from '@/components/system-config/PensionesSettingsCard';
import { PromotoriaSettingsCard } from '@/components/system-config/PromotoriaSettingsCard';
import { isPensionesEnabled } from '@/config/features';
import { SYSTEM_SETTINGS } from '@/config/systemSettings';
import { authService } from '@/lib/services';

export const SystemConfig = () => {
  const role = authService.getCurrentUser()?.role;
  const isCajero = role === 'Cajero';

  if (isCajero) {
    return (
      <div className="app-page app-page-shell space-y-6">
        <PageHeader
          icon={Settings}
          eyebrow="Administración"
          title="Configuración de pensiones"
          description="Día de vencimiento, monto referencial y aviso sonoro del colegio"
          accent="secondary"
        />
        {isPensionesEnabled() ? (
          <PensionesSettingsCard />
        ) : (
          <p className="text-sm text-muted-foreground">El módulo de pensiones no está habilitado.</p>
        )}
      </div>
    );
  }

  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={Settings}
        eyebrow="Administración"
        title="Configuración del Sistema"
        description="Horarios de asistencia, reincidencia y pensiones que aplican a todo el colegio"
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
      {isPensionesEnabled() && <PensionesSettingsCard />}
      {role === 'Admin' && <PromotoriaSettingsCard />}
    </div>
  );
};
