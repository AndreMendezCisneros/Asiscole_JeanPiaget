import type { CSSProperties } from 'react';

const NAV_ITEMS = [
  { label: 'Inicio', active: false },
  { label: 'Incidencias', active: true },
  { label: 'Asistencia', active: false },
  { label: 'Alumnos', active: false },
];

const STATS = [
  { label: 'Hoy', value: '3', tone: 'warning' as const },
  { label: 'Pendientes', value: '12', tone: 'neutral' as const },
  { label: 'Nivel alto', value: '2', tone: 'danger' as const },
];

const INCIDENTS = [
  { student: 'María G. — 4to A', fault: 'Falta de respeto', level: 2, tone: 'warning' as const },
  { student: 'Carlos R. — 5to B', fault: 'Fuga de colegio', level: 5, tone: 'danger' as const, highlight: true },
  { student: 'Ana L. — 3ro C', fault: 'Uniforme incompleto', level: 1, tone: 'success' as const },
];

/** Portátil animado con vista previa del módulo de incidencias SIE */
export const LoginLaptopMockup = () => {
  return (
    <div className="login-laptop" aria-hidden>
      <div className="login-laptop__float" data-login-laptop-inner>
        <div className="login-laptop__lid">
          <div className="login-laptop__bezel">
            <div className="login-laptop__screen">
              <div className="login-mock-ui">
                <aside className="login-mock-ui__sidebar">
                  <div className="login-mock-ui__brand">
                    <span className="login-mock-ui__shield" />
                    <span className="login-mock-ui__brand-text">SIE</span>
                  </div>
                  <nav className="login-mock-ui__nav-list">
                    {NAV_ITEMS.map((item, i) => (
                      <div
                        key={item.label}
                        className={`login-mock-ui__nav-item ${item.active ? 'login-mock-ui__nav-item--active' : ''}`}
                        style={{ animationDelay: `${i * 0.12}s` }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </nav>
                </aside>

                <div className="login-mock-ui__main">
                  <header className="login-mock-ui__header">
                    <div>
                      <p className="login-mock-ui__eyebrow">Panel de control</p>
                      <h3 className="login-mock-ui__title">Incidencias recientes</h3>
                    </div>
                    <span className="login-mock-ui__cta">+ Registrar</span>
                  </header>

                  <div className="login-mock-ui__stats">
                    {STATS.map((stat, i) => (
                      <div
                        key={stat.label}
                        className={`login-mock-ui__stat login-mock-ui__stat--${stat.tone}`}
                        style={{ animationDelay: `${i * 0.15}s` } as CSSProperties}
                      >
                        <span className="login-mock-ui__stat-value">{stat.value}</span>
                        <span className="login-mock-ui__stat-label">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="login-mock-ui__table-head">
                    <span>Estudiante</span>
                    <span>Falta</span>
                    <span>Nivel</span>
                  </div>

                  <ul className="login-mock-ui__list">
                    {INCIDENTS.map((row, i) => (
                      <li
                        key={row.student}
                        className={`login-mock-ui__row ${row.highlight ? 'login-mock-ui__row--alert' : ''}`}
                        style={{ animationDelay: `${i * 0.25}s` } as CSSProperties}
                      >
                        <span className="login-mock-ui__student">{row.student}</span>
                        <span className="login-mock-ui__fault">{row.fault}</span>
                        <span
                          className={`login-mock-ui__badge login-mock-ui__badge--${row.tone}`}
                        >
                          N{row.level}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="login-mock-ui__scanner">
                    <span className="login-mock-ui__scanner-icon" />
                    <span className="login-mock-ui__scanner-text">Escanear código de barras</span>
                    <span className="login-mock-ui__scanner-line" />
                  </div>
                </div>
              </div>
              <div className="login-laptop__screen-glow" />
            </div>
          </div>
        </div>
        <div className="login-laptop__base">
          <div className="login-laptop__trackpad" />
        </div>
      </div>
      <div className="login-laptop__reflection" />
    </div>
  );
};
