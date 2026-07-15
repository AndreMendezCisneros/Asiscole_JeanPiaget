import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion, motionDuration } from '@/lib/utils/motionPrefs';

export { prefersReducedMotion, motionDuration };

let registered = false;

/** Registra plugins GSAP una sola vez (patrón gsap-react skill). */
export function ensureGsapRegistered(): void {
  if (registered) return;
  gsap.registerPlugin(useGSAP);
  registered = true;
}

ensureGsapRegistered();
