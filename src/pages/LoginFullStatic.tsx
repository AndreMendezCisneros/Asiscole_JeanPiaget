import { ErrorDialog } from '@/components/ui/error-dialog';
import { LoginHeroPanel, LoginMobileIntro } from '@/components/login/LoginHeroPanel';
import { LoginCinematicBackdrop } from '@/components/login/LoginCinematicBackdrop';
import { LoginFormFields } from '@/components/login/LoginFormFields';
import { useLoginForm } from '@/hooks/useLoginForm';

/** Login completo (panel hero + carnet) sin GSAP — laptops y fallback de carga. */
export function LoginFullStatic() {
  const form = useLoginForm();

  return (
    <div className="login-page login-page--gsap-fallback">
      <LoginCinematicBackdrop />
      <LoginHeroPanel />

      <main id="main-content" className="login-panel" data-login-panel-split>
        <div className="login-panel__inner">
          <LoginMobileIntro />
          <LoginFormFields form={form} />
        </div>
      </main>

      <ErrorDialog
        open={form.errorDialog.open}
        onOpenChange={(open) => !open && form.closeError()}
        title={form.errorDialog.title}
        message={form.errorDialog.message}
        buttonText="OK"
        variant={form.errorDialog.variant}
      />
    </div>
  );
}
