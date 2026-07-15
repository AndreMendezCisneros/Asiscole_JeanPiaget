/** Preferencias de movimiento — sin dependencia de GSAP (seguro en tablets). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function motionDuration(normalSeconds: number): number {
  return prefersReducedMotion() ? 0 : normalSeconds;
}
