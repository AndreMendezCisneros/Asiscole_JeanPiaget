import { useEffect } from 'react';

/**
 * Sincroniza altura del visual viewport (teclado virtual en tablet/móvil)
 * para que el panel del estudiante no quede tapado.
 */
export function useTutorViewport(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty('--tutor-vv-height', `${vv.height}px`);
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--tutor-keyboard-inset', `${inset}px`);
    };

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    sync();

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      root.style.removeProperty('--tutor-vv-height');
      root.style.removeProperty('--tutor-keyboard-inset');
    };
  }, [active]);
}
