import { type RefObject, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { motionDuration } from '@/lib/gsap/setup';
import type { ParentTab } from '@/components/parent/ParentBottomNav';

const TAB_ORDER: ParentTab[] = ['resumen', 'asistencia', 'incidencias', 'citas'];

type ParentPortalAnimDeps = {
  ready: boolean;
  tab: ParentTab;
  studentId: string;
};

/** Animaciones del portal familiar: hero, stats, tarjetas y cambio de pestaña. */
export function useParentPortalAnimations(
  scopeRef: RefObject<HTMLElement | null>,
  { ready, tab, studentId }: ParentPortalAnimDeps
) {
  const prevTabRef = useRef<ParentTab>(tab);
  const entranceStudentRef = useRef<string | null>(null);

  useGSAP(
    () => {
      if (!ready) return;

      const dur = motionDuration(0.48);
      if (dur === 0) {
        gsap.set('[data-parent-anim]', { autoAlpha: 1, clearProps: 'transform' });
        return;
      }

      const tabIndex = TAB_ORDER.indexOf(tab);
      const prevIndex = TAB_ORDER.indexOf(prevTabRef.current);
      const slideDir = tabIndex >= prevIndex ? 1 : -1;
      const needsEntrance = entranceStudentRef.current !== studentId;

      if (needsEntrance) {
        entranceStudentRef.current = studentId;

        gsap.set('[data-parent-anim]', { autoAlpha: 0 });

        const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

        tl.fromTo(
          '[data-parent-hero]',
          { y: 24, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: dur, ease: 'power3.out' },
          0
        )
          .fromTo(
            '[data-parent-nav]',
            { y: 16, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: dur * 0.9 },
            0.1
          )
          .fromTo(
            '[data-parent-panel]',
            { y: 20, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: dur * 0.95, ease: 'power3.out' },
            0.16
          )
          .fromTo(
            '[data-parent-stat]',
            { y: 18, autoAlpha: 0, scale: 0.96 },
            {
              y: 0,
              autoAlpha: 1,
              scale: 1,
              duration: 0.42,
              stagger: 0.06,
              ease: 'back.out(1.35)',
            },
            0.24
          )
          .fromTo(
            '[data-parent-card]',
            { y: 14, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' },
            0.28
          );
      } else if (prevTabRef.current !== tab) {
        gsap.fromTo(
          '[data-parent-panel]',
          { x: 28 * slideDir, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.42, ease: 'power3.out' }
        );
        gsap.fromTo(
          '[data-parent-panel] [data-parent-stat]',
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.04, ease: 'back.out(1.2)', delay: 0.06 }
        );
        gsap.fromTo(
          '[data-parent-panel] [data-parent-card]',
          { y: 10, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.32, stagger: 0.04, delay: 0.1 }
        );
      } else {
        gsap.set('[data-parent-anim]', { autoAlpha: 1, clearProps: 'transform' });
      }

      prevTabRef.current = tab;
    },
    {
      scope: scopeRef,
      dependencies: [ready, tab, studentId],
    }
  );
}

/** Header del shell familiar al montar. */
export function useParentShellAnimation(scopeRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const dur = motionDuration(0.42);
      if (dur === 0) {
        gsap.set('[data-parent-shell-anim]', { autoAlpha: 1, clearProps: 'transform' });
        return;
      }

      gsap.fromTo(
        '[data-parent-shell-anim]',
        { y: -14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: dur, ease: 'power3.out', stagger: 0.07 }
      );

      gsap.fromTo(
        '[data-parent-shell-glow]',
        { scaleX: 0.6, autoAlpha: 0 },
        { scaleX: 1, autoAlpha: 1, duration: 0.65, ease: 'power2.out', delay: 0.05 }
      );
    },
    { scope: scopeRef }
  );
}
