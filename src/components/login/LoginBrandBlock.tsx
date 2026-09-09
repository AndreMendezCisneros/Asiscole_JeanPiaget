import { BRAND_LOGIN_LOGO } from '@/config/brandAssets';

interface LoginBrandBlockProps {
  compact?: boolean;
}

/** Marca Asiscole en login. */
export function LoginBrandBlock({ compact = false }: LoginBrandBlockProps) {
  const rootClass = compact ? 'login-brand login-brand--compact' : 'login-brand';

  return (
    <div className={rootClass}>
      <div className="login-brand__logo-stack">
        <span className="login-brand__logo-halo" aria-hidden />
        <div className="login-brand__logo-clip" data-login-brand-mark>
          <img
            src={BRAND_LOGIN_LOGO}
            alt="Asiscole"
            className="login-brand__logo"
            width={132}
            height={132}
            draggable={false}
          />
        </div>
      </div>
      {!compact && (
        <p className="login-brand__caption" data-login-brand-line>
          Sistema de incidencias escolares
        </p>
      )}
    </div>
  );
}
