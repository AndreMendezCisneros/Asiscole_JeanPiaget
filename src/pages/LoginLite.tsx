import { ErrorDialog } from '@/components/ui/error-dialog';
import { LoginBrandBlock } from '@/components/login/LoginBrandBlock';
import { LoginFormFields } from '@/components/login/LoginFormFields';
import { useLoginForm } from '@/hooks/useLoginForm';

/**
 * Login sin GSAP — para tablets del colegio.
 * No importa gsap-vendor; el formulario es visible desde el primer frame.
 */
export function LoginLite() {
  const form = useLoginForm();

  return (
    <div className="login-page login-page--minimal login-page--lite">
      <main id="main-content" className="login-panel login-panel--lite">
        <div className="login-panel__inner login-panel__inner--lite">
          <div className="login-lite-brand">
            <LoginBrandBlock compact />
            <p className="login-lite-brand__tag">Sistema de asistencia e incidencias</p>
          </div>
          <LoginFormFields form={form} lite />
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
