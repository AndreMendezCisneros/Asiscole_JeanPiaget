import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SessionIncidentRow {
  id: number;
  studentName: string;
  faultName: string;
  time: string;
}

interface IncidentSessionSidebarProps {
  sessionCount: number;
  recentIncidents: SessionIncidentRow[];
}

export function IncidentSessionSidebar({ sessionCount, recentIncidents }: IncidentSessionSidebarProps) {
  return (
    <div className="tutor-side-stack">
      <div className="tutor-side-card">
        <div className="tutor-side-card__head">
          <CardTitle className="text-base font-semibold">Sesión actual</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Incidencias registradas hoy en esta sesión.</p>
        </div>
        <div className="tutor-kpis">
          <div className="tutor-kpi">
            <p className="tutor-kpi__value">{sessionCount}</p>
            <p className="tutor-kpi__label">Total</p>
          </div>
        </div>
      </div>

      <div className="tutor-side-card">
        <div className="tutor-side-card__head">
          <CardTitle className="text-base font-semibold">Últimas incidencias</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Historial rápido (máx. 6).</p>
        </div>
        <div className="tutor-feed">
          {recentIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay incidencias en esta sesión. Busque un estudiante para empezar.
            </p>
          ) : (
            recentIncidents.map((row) => (
              <div key={row.id} className="tutor-feed__row">
                <div className="min-w-0">
                  <span className="tutor-feed__name block truncate">{row.studentName}</span>
                  <span className="text-xs text-muted-foreground truncate block">{row.faultName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tutor-feed__time">{row.time}</span>
                  <Badge variant="secondary">OK</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
