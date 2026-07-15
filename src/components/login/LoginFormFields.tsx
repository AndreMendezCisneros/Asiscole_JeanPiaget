import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Eye, EyeOff, ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { BRAND_LOGIN_LOGO } from '@/config/brandAssets';
import { SCHOOL_NAME } from '@/config/siteSeo';
import type { useLoginForm } from '@/hooks/useLoginForm';

type LoginFormState = ReturnType<typeof useLoginForm>;

interface LoginFormFieldsProps {
  form: LoginFormState;
  /** Sin atributos data-login-* (evita que GSAP oculte el formulario). */
  lite?: boolean;
}

export function LoginFormFields({ form, lite = false }: LoginFormFieldsProps) {
  const fieldAnim = lite ? {} : { 'data-login-field': true, 'data-login-anim': true };

  return (
    <div className="login-form-card" {...(lite ? {} : { 'data-login-card': true, 'data-login-anim': true })}>
      {!lite && <div className="login-form-card__line" data-login-card-line aria-hidden />}

      <header className="login-form-card__header">
        <h1 className="login-title" {...(lite ? {} : { 'data-login-title': true, 'data-login-anim': true })}>
          <span className="sr-only">
            Iniciar sesión — Sistema de Incidencias y Asistencia Escolar {SCHOOL_NAME}
          </span>
          <span aria-hidden="true">Entrar</span>
        </h1>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Acceso para personal docente y administración
        </p>
      </header>

      <form onSubmit={form.handleLogin} className="login-form">
        <div className="login-field-group" {...fieldAnim}>
          <Label htmlFor="username" className="sr-only">Usuario</Label>
          <Input
            id="username"
            type="text"
            value={form.username}
            onChange={(e) => form.setUsername(e.target.value)}
            autoComplete="username"
            disabled={form.loading}
            className="login-input"
            placeholder="Usuario"
          />
        </div>

        <div className="login-field-group" {...fieldAnim}>
          <Label htmlFor="password" className="sr-only">Contraseña</Label>
          <div className="login-input-wrap">
            <Input
              id="password"
              type={form.showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => form.setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={form.loading}
              className="login-input login-input--password"
              placeholder="Contraseña"
            />
            <button
              type="button"
              onClick={() => form.setShowPassword((v) => !v)}
              className="login-password-toggle"
              aria-label={form.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={form.showPassword}
            >
              {form.showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>

        <div className="login-form__row" {...fieldAnim}>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={form.rememberMe}
              onCheckedChange={(checked) => form.setRememberMe(checked === true)}
              disabled={form.loading}
              className="login-checkbox"
            />
            <Label htmlFor="remember" className="login-remember-label">Recordarme</Label>
          </div>
          <button
            type="button"
            className="login-link"
            onClick={() => toast.info('Contacte al administrador para recuperar su contraseña')}
            disabled={form.loading}
          >
            ¿Olvidó clave?
          </button>
        </div>

        <Button type="submit" disabled={form.loading} className="login-btn" {...fieldAnim}>
          {form.loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando…</>
          ) : (
            <>Continuar<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></>
          )}
        </Button>
      </form>

      <Link to="/portal-padres" className="login-parent-link" {...fieldAnim}>
        <Users className="h-3.5 w-3.5" aria-hidden />
        Soy padre / apoderado
        <ArrowRight className="h-3.5 w-3.5 ml-auto" aria-hidden />
      </Link>

      <p className="login-form-card__footer text-center text-[11px] leading-relaxed text-muted-foreground">
        <span className="block mb-2">
          SIE Asiscole — plataforma de incidencias disciplinarias y control de asistencia del{' '}
          {SCHOOL_NAME}.
        </span>
        <img
          src={BRAND_LOGIN_LOGO}
          alt="Guardy — software educativo"
          className="login-form-card__footer-logo mx-auto"
          width={96}
          height={32}
          draggable={false}
        />
      </p>
    </div>
  );
}
