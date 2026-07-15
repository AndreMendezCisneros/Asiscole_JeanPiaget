import { type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/lib/utils/motionPrefs';
import { shouldSkipHeavyAnimations } from '@/lib/utils/deviceCompat';

const BEAM_SEL = '[data-login-visual-beam], [data-login-visual-beam-core], [data-login-visual-beam-glow]';
const SWEEP = 1.15;
/** Espera a que la entrada se asiente antes de iniciar el idle (evita conflictos de ejes). */
const IDLE_DELAY = 2.1;
/** El barrido periódico arranca tras completarse la secuencia de entrada. */
const SCAN_DELAY = 3.4;

/** Ambiente — barrido periódico + micro-animaciones idle suaves del carnet. */
export function useLoginAmbientAnimation(scopeRef: RefObject<HTMLElement | null>) {
  useGSAP(
    (_, contextSafe) => {
      if (prefersReducedMotion() || shouldSkipHeavyAnimations()) return;

      /* ── Loop de escaneo periódico (sin sacudidas) ──────────── */
      const sweepEnd = 0.35 + SWEEP;

      const scanLoop = gsap.timeline({ repeat: -1, repeatDelay: 3.2, delay: SCAN_DELAY });
      scanLoop
        .to('.login-carnet-scanner__corner', {
          opacity: 1, scale: 1.1, duration: 0.5, stagger: 0.05, yoyo: true, repeat: 1, ease: 'sine.inOut',
        }, 0)
        .to('[data-login-visual-scan-overlay]', { autoAlpha: 0.3, duration: 0.3, ease: 'sine.inOut' }, 0.25)
        .set('[data-login-visual-card-scanline]', { top: '0%', autoAlpha: 0.9 }, 0.35)
        .to('[data-login-visual-card-scanline]', {
          top: 'calc(100% - 3px)', duration: SWEEP, ease: 'sine.inOut',
        }, 0.35)
        .to('[data-login-visual-barcode-zone]', { scale: 1.04, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }, sweepEnd)
        .to(BEAM_SEL, { left: 'calc(100% - 3px)', duration: 0.26, ease: 'power2.inOut' }, sweepEnd + 0.04)
        .to('[data-login-visual-spark]', {
          autoAlpha: 1, scale: 1.15, duration: 0.16,
          stagger: { amount: 0.14, from: 'center' }, yoyo: true, repeat: 1, ease: 'sine.out',
        }, sweepEnd + 0.06)
        .to('[data-login-visual-scan-overlay]', { autoAlpha: 0, duration: 0.35, ease: 'sine.inOut' }, sweepEnd + 0.12)
        .to('[data-login-visual-card-scanline]', { autoAlpha: 0, duration: 0.25 }, sweepEnd + 0.1)
        .set(BEAM_SEL, { left: '0%' }, sweepEnd + 0.4);

      /* ── Levitación del carnet (suave, tras la entrada) ─────── */
      gsap.to('[data-login-visual-card]', {
        y: -10, duration: 3.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });

      /* ── Inclinación 3D muy sutil en idle ───────────────────── */
      gsap.to('[data-login-visual-card]', {
        rotationZ: 0.8, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });

      /* ── Halos / anillos (respiración lenta) ────────────────── */
      gsap.to('[data-login-visual-halo]', {
        scale: 1.22, opacity: 0.9, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });
      gsap.to('[data-login-visual-glow-ring]', {
        scale: 1.12, opacity: 0.8, duration: 3.0, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });
      gsap.to('[data-login-visual-pulse-ring]', {
        scale: 1.24, opacity: 0.55, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });

      /* ── Esquinas con brillo tenue ──────────────────────────── */
      gsap.to('.login-carnet-scanner__corner', {
        opacity: 0.4, duration: 1.6, ease: 'sine.inOut',
        yoyo: true, repeat: -1, stagger: 0.18, delay: IDLE_DELAY,
      });

      /* ── Zona barcode pulsa lento ───────────────────────────── */
      gsap.to('[data-login-visual-barcode-zone]', {
        scale: 1.02, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: 'center', delay: IDLE_DELAY,
      });

      /* ── Shimmer de borde ───────────────────────────────────── */
      gsap.to('[data-login-visual-edge-glow]', {
        opacity: 0.85, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: IDLE_DELAY,
      });

      /* ── Marca/logo halo ────────────────────────────────────── */
      gsap.to('.login-brand__logo-halo', {
        opacity: 0.5, scale: 1.08, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1,
      });

      /* ── Líneas formulario ──────────────────────────────────── */
      gsap.to('[data-login-card-line]', {
        opacity: 0.52, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1,
      });

      /* ── Malla de fondo (deriva muy lenta) ──────────────────── */
      gsap.to('[data-login-mesh]', {
        rotation: '+=8', x: '+=16', duration: 28, ease: 'sine.inOut', repeat: -1, yoyo: true, stagger: 4,
      });

      /* ── Parallax 3D con el ratón (amortiguado, premium) ────── */
      const visualX  = gsap.quickTo('[data-login-visual-inner]', 'x',         { duration: 1.1, ease: 'power3.out' });
      const visualY  = gsap.quickTo('[data-login-visual-inner]', 'y',         { duration: 1.1, ease: 'power3.out' });
      const cardRY   = gsap.quickTo('[data-login-visual-card]',  'rotationY', { duration: 1.1, ease: 'power3.out' });
      const cardRX   = gsap.quickTo('[data-login-visual-card]',  'rotationX', { duration: 1.1, ease: 'power3.out' });

      const onMove = contextSafe((e: MouseEvent) => {
        const nx = e.clientX / window.innerWidth  - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        visualX(nx * 8);
        visualY(ny * 5);
        cardRY(nx * 7);
        cardRX(-ny * 5);
      });

      /* Activa el parallax solo cuando la entrada ya asentó las rotaciones. */
      const enableParallax = gsap.delayedCall(IDLE_DELAY, () => {
        window.addEventListener('mousemove', onMove);
      });

      return () => {
        window.removeEventListener('mousemove', onMove);
        enableParallax.kill();
        scanLoop.kill();
      };
    },
    { scope: scopeRef }
  );
}
