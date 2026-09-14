import { BRAND_LOGIN_LOGO } from '@/config/brandAssets';
import { SCHOOL_NAME, SCHOOL_TAGLINE, SITE_NAME } from '@/config/siteSeo';

interface LoginBrandBlockProps {
  compact?: boolean;
}

/** Marca Asis Academy en login — logo oficial sobre placa blanca. */
export function LoginBrandBlock({ compact = false }: LoginBrandBlockProps) {
  const rootClass = compact ? 'login-brand login-brand--compact' : 'login-brand';

  return (
    <div className={rootClass}>
      <div className="login-brand__logo-stack">
        <span className="login-brand__logo-halo" aria-hidden />
        <div className="login-brand__logo-clip" data-login-brand-mark>
          <img
            src={BRAND_LOGIN_LOGO}
            alt="Asis Academy"
            className="login-brand__logo"
            draggable={false}
          />
        </div>
      </div>
      {!compact && (
        <div className="flex flex-col items-center gap-1" data-login-brand-line>
          <p className="login-brand__caption">{SITE_NAME}</p>
          <p className="m-0 max-w-[16rem] text-center text-[11px] font-medium text-white/80">
            {SCHOOL_NAME}
          </p>
          <p className="m-0 max-w-[16rem] text-center text-[12px] italic text-white/70">
            {SCHOOL_TAGLINE}
          </p>
        </div>
      )}
    </div>
  );
}
