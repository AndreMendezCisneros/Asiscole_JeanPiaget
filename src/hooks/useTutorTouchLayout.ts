import { useEffect, useState } from 'react';
import { isTutorTouchLayout } from '@/lib/utils/deviceCompat';

/** Detecta tablet/móvil del colegio; reacciona a rotación y cambios de viewport. */
export function useTutorTouchLayout(): boolean {
  const [touch, setTouch] = useState(() =>
    typeof window !== 'undefined' ? isTutorTouchLayout() : false,
  );

  useEffect(() => {
    const update = () => setTouch(isTutorTouchLayout());
    update();

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    const mqs = [
      '(pointer: coarse)',
      '(max-width: 1023px)',
      '(hover: none)',
    ].map((q) => window.matchMedia(q));
    mqs.forEach((mq) => mq.addEventListener('change', update));

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mqs.forEach((mq) => mq.removeEventListener('change', update));
    };
  }, []);

  return touch;
}
