import { Shield, Users, BarChart3 } from 'lucide-react';
import { LoginHeroIllustration } from '@/components/login/LoginHeroIllustration';
import { LoginBrandBlock } from '@/components/login/LoginBrandBlock';

const MODULES = [
  { icon: Shield, label: 'Incidencias' },
  { icon: Users, label: 'Asistencia' },
  { icon: BarChart3, label: 'Reportes' },
] as const;

export function LoginHeroPanel() {
  return (
    <aside className="login-hero" data-login-hero-split>
      <div className="login-hero__orb login-hero__orb--a" data-login-orb aria-hidden />
      <div className="login-hero__orb login-hero__orb--b" data-login-orb aria-hidden />
      <div className="login-hero__glow" data-login-glow aria-hidden />
      <div className="login-hero__grid" data-login-grid aria-hidden />

      <div className="login-hero__inner">
        <div className="login-hero__brand" data-login-brand data-login-anim>
          <LoginBrandBlock />
        </div>

        <div className="login-hero-visual-stage" data-login-visual data-login-anim>
          <LoginHeroIllustration />
        </div>

        <div className="login-hero__copy" data-login-copy data-login-anim>
          <h2 className="login-hero__title" data-login-hero-title>
            Tu colegio,
            <span className="login-hero__title-accent"> bajo control</span>
          </h2>

          <ul className="login-module-row" aria-label="Módulos">
            {MODULES.map(({ icon: Icon, label }) => (
              <li key={label} className="login-module-row__item" data-login-module data-login-anim>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function LoginMobileIntro() {
  return (
    <div className="login-mobile-intro lg:hidden" data-login-mobile-intro data-login-anim>
      <LoginBrandBlock compact />
    </div>
  );
}
