import { Suspense, lazy } from 'react';
import { shouldUseLiteLogin, shouldSkipHeavyAnimations } from '@/lib/utils/deviceCompat';
import { LoginLite } from './LoginLite';
import { LoginFullStatic } from './LoginFullStatic';

const LoginAnimated = lazy(() =>
  import('./LoginAnimated').then((m) => ({ default: m.LoginAnimated }))
);

export const Login = () => {
  // Móvil / tablet: formulario simple
  if (shouldUseLiteLogin()) {
    return <LoginLite />;
  }

  // Laptop: login completo sin animaciones pesadas (p. ej. reduced motion)
  if (shouldSkipHeavyAnimations()) {
    return <LoginFullStatic />;
  }

  // Laptop: login completo con animaciones GSAP
  return (
    <Suspense fallback={<LoginFullStatic />}>
      <LoginAnimated />
    </Suspense>
  );
};
