import { BRAND_LOGIN_LOGO } from '@/config/brandAssets';

interface LoginBrandBlockProps {
  compact?: boolean;
}

/** Marca Guardy en login — logo oficial (escudo + wordmark morado). */
export function LoginBrandBlock({ compact = false }: LoginBrandBlockProps) {
  const rootClass = compact ? 'login-brand login-brand--compact' : 'login-brand';

  return (
    <div className={rootClass}>
      <div className="login-brand__logo-stack">
        <span className="login-brand__logo-halo" aria-hidden />
        <div className="login-brand__logo-clip" data-login-brand-mark>
          <img
            src={BRAND_LOGIN_LOGO}
            alt="Guardy"
            className="login-brand__logo"
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
