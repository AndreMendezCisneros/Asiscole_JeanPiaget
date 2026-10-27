import { BellRing } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PromotoriaSettingsCard } from '@/components/system-config/PromotoriaSettingsCard';

/** RR.HH. elige quiénes reciben en la app los avisos del personal. */
export const PersonalPromotoria = () => (
  <div className="app-page app-page-shell space-y-6">
    <PageHeader
      icon={BellRing}
      eyebrow="Personal"
      title="Promotoría (avisos del personal)"
      description="Celular que recibe en la app Asiscole las llegadas, tardanzas, inasistencias, salidas e incidencias de todo el personal"
      accent="info"
    />
    <PromotoriaSettingsCard />
  </div>
);

export default PersonalPromotoria;
