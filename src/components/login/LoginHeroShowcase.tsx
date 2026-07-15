import type { CSSProperties } from 'react';
import { Barcode, Bell, ClipboardList, Users } from 'lucide-react';

const KPI = [
  { label: 'Hoy', value: '3', tone: 'warning' as const },
  { label: 'Pendientes', value: '12', tone: 'neutral' as const },
  { label: 'Nivel alto', value: '2', tone: 'danger' as const },
];

const INCIDENTS = [
  { student: 'María G. · 4to A', fault: 'Falta de respeto', level: 2, tone: 'warning' as const },
  {
    student: 'Carlos R. · 5to B',
    fault: 'Fuga de colegio',
    level: 5,
    tone: 'danger' as const,
    alert: true,
  },
  { student: 'Ana L. · 3ro C', fault: 'Uniforme incompleto', level: 1, tone: 'success' as const },
];

const FLOW = [
  { icon: Barcode, label: 'Escaneo tutor' },
  { icon: ClipboardList, label: 'Incidencia' },
  { icon: Bell, label: 'Aviso padres' },
] as const;

/** Vista previa del panel SIE — sin portátil, directamente el producto. */
export function LoginHeroShowcase() {
  return (
    <div className="login-showcase" aria-hidden>
      <div className="login-showcase__card" data-login-showcase-inner>
        <header className="login-showcase__header">
          <div>
            <p className="login-showcase__eyebrow">Panel en vivo</p>
            <h3 className="login-showcase__title">Incidencias recientes</h3>
          </div>
          <span className="login-showcase__live" data-login-showcase-pulse>
            <span className="login-showcase__live-dot" />
            Activo
          </span>
        </header>

        <div className="login-showcase__kpis">
          {KPI.map((item, index) => (
            <div
              key={item.label}
              className={`login-showcase__kpi login-showcase__kpi--${item.tone}`}
              data-login-showcase-kpi
              style={{ animationDelay: `${index * 0.12}s` } as CSSProperties}
            >
              <span className="login-showcase__kpi-value">{item.value}</span>
              <span className="login-showcase__kpi-label">{item.label}</span>
            </div>
          ))}
        </div>

        <ul className="login-showcase__list">
          {INCIDENTS.map((row, index) => (
            <li
              key={row.student}
              className={`login-showcase__row ${row.alert ? 'login-showcase__row--alert' : ''}`}
              data-login-showcase-row
              style={{ animationDelay: `${index * 0.1}s` } as CSSProperties}
            >
              <span className="login-showcase__student">{row.student}</span>
              <span className="login-showcase__fault">{row.fault}</span>
              <span className={`login-showcase__badge login-showcase__badge--${row.tone}`}>
                N{row.level}
              </span>
            </li>
          ))}
        </ul>

        <div className="login-showcase__scanner" data-login-showcase-scanner>
          <Barcode className="login-showcase__scanner-icon" aria-hidden />
          <span className="login-showcase__scanner-text">Escaneo de llegada — tutor</span>
          <span className="login-showcase__scanner-beam" aria-hidden />
        </div>
      </div>

      <ul className="login-showcase__flow" aria-hidden>
        {FLOW.map(({ icon: Icon, label }, index) => (
          <li
            key={label}
            className="login-showcase__flow-step"
            data-login-showcase-flow
            style={{ animationDelay: `${index * 0.15}s` } as CSSProperties}
          >
            <span className="login-showcase__flow-icon">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{label}</span>
            {index < FLOW.length - 1 && (
              <span className="login-showcase__flow-arrow" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      <div className="login-showcase__roles" data-login-showcase-roles>
        <Users className="h-3.5 w-3.5" aria-hidden />
        <span>Director · Supervisor · Tutor · Padres</span>
      </div>
    </div>
  );
}
