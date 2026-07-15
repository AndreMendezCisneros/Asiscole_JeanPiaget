import { useEffect, useRef } from 'react';
import { ErrorDialog } from '@/components/ui/error-dialog';
import { LoginHeroPanel, LoginMobileIntro } from '@/components/login/LoginHeroPanel';
import { LoginCinematicBackdrop } from '@/components/login/LoginCinematicBackdrop';
import { LoginFormFields } from '@/components/login/LoginFormFields';
import { useLoginEnterAnimation } from '@/hooks/useLoginEnterAnimation';
import { useLoginAmbientAnimation } from '@/hooks/useLoginAmbientAnimation';
import { useLoginForm } from '@/hooks/useLoginForm';

/** Login con animaciones GSAP — solo escritorio / navegadores modernos. */
export function LoginAnimated() {
  const form = useLoginForm();
  const pageRef = useRef<HTMLDivElement>(null);
  useLoginEnterAnimation(pageRef);
  useLoginAmbientAnimation(pageRef);

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      pageRef.current?.classList.add('login-page--gsap-fallback');
    }, 2500);
    return () => window.clearTimeout(fallback);
  }, []);

  return (
    <div className="login-page login-page--minimal" ref={pageRef}>
      <div className="login-iris-reveal" data-login-iris aria-hidden />
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
