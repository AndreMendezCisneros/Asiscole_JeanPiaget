import { FilePlus2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PersonalIncidentForm } from '@/components/personal/PersonalIncidentForm';

export const PersonalRegisterIncident = () => (
  <div className="app-page app-page-shell">
    <PageHeader
      icon={FilePlus2}
      eyebrow="Personal"
      title="Registrar Incidencia del Personal"
      description="Busque al empleado, elija la falta del catálogo y agregue una observación"
      accent="accent"
    />
    <PersonalIncidentForm />
  </div>
);

export default PersonalRegisterIncident;
