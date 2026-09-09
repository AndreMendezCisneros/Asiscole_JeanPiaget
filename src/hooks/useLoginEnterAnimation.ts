import { type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { motionDuration } from '@/lib/utils/motionPrefs';
import { shouldSkipHeavyAnimations } from '@/lib/utils/deviceCompat';
import { addSetIf, addToIf, setIf } from '@/lib/utils/gsapTargets';

const VISIBLE_SEL =
  '[data-login-anim], [data-login-panel-split], [data-login-mobile-intro], [data-login-card], [data-login-field], [data-login-title]';

function revealLoginWithoutMotion(scope: HTMLElement | null): void {
  scope?.classList.add('login-page--no-motion');
  setIf(VISIBLE_SEL, { autoAlpha: 1, clearProps: 'transform,clipPath,filter' });
  setIf('[data-login-iris]', { autoAlpha: 0, clearProps: 'clipPath' });
}

const BEAM_SEL = '[data-login-visual-beam], [data-login-visual-beam-core], [data-login-visual-beam-glow]';
const SWEEP = 1.05;

/** Entrada — el carnet se materializa con profundidad y un barrido de escáner elegante. */
export function useLoginEnterAnimation(scopeRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      if (shouldSkipHeavyAnimations()) {
        revealLoginWithoutMotion(scopeRef.current);
        return;
      }

      const dur = motionDuration(0.5);
      if (dur === 0) {
        revealLoginWithoutMotion(scopeRef.current);
        return;
      }

      /* ── ESTADO INICIAL ─────────────────────────────────────── */
      setIf('[data-login-iris]',           { clipPath: 'circle(0% at 50% 45%)', autoAlpha: 1 });
      setIf('[data-login-anim]',           { autoAlpha: 0 });
      setIf('[data-login-hero-split]',     { x: -64, autoAlpha: 0 });
      setIf('[data-login-panel-split]',    { x: 64,  autoAlpha: 0 });
      setIf('[data-login-brand-mark]',     { scale: 0.86, y: 14, autoAlpha: 0 });
      setIf('[data-login-brand-line]',     { y: 10, autoAlpha: 0 });
      setIf('[data-login-visual-inner]',   { scale: 0.9, y: 24, autoAlpha: 0 });
      setIf('[data-login-visual-halo]',    { scale: 0.7, autoAlpha: 0 });
      setIf('[data-login-visual-glow-ring]',  { scale: 0.74, autoAlpha: 0 });
      setIf('[data-login-visual-pulse-ring]', { scale: 0.6, autoAlpha: 0 });
      setIf('[data-login-visual-scanner]', { scale: 0.92, autoAlpha: 0, rotationX: 10 });
      setIf('[data-login-visual-scan-overlay]',  { autoAlpha: 0 });
      setIf('[data-login-visual-scan-cone]',     { autoAlpha: 0 });
      setIf('[data-login-visual-card-scanline]', { top: '0%', autoAlpha: 0 });
      setIf('[data-login-visual-card]', {
        y: 46, scale: 0.9, autoAlpha: 0,
        rotationY: -13, rotationX: 7,
        transformPerspective: 1100,
        transformOrigin: 'center center',
      });
      setIf('[data-login-visual-orbit]',      { autoAlpha: 0 });
      setIf('[data-login-visual-edge-glow]',  { autoAlpha: 0 });
      setIf('[data-login-visual-shimmer]',    { autoAlpha: 0 });
      setIf('[data-login-visual-carnet-part]', { y: 12, autoAlpha: 0 });
      setIf('[data-login-visual-carnet-part="photo"]', { scale: 0.86, autoAlpha: 0, transformOrigin: 'center' });
      setIf('[data-login-visual-carnet-part="chip"]',  { scale: 0.5, autoAlpha: 0, transformOrigin: 'center' });
      setIf('[data-login-visual-bars]',           { scaleY: 0, transformOrigin: 'center bottom' });
      setIf('[data-login-visual-barcode-zone]',   { autoAlpha: 0, scale: 0.92 });
      setIf(BEAM_SEL,                             { left: '0%' });
      setIf('[data-login-visual-spark]',          { autoAlpha: 0, scale: 0 });
      setIf('[data-login-visual-flash]',          { autoAlpha: 0 });
      setIf('[data-login-visual-success-ring]',   { autoAlpha: 0, scale: 0.4 });
      setIf('.login-carnet-scanner__corner',      { scale: 0.55, autoAlpha: 0 });
      setIf('[data-login-hero-title]',  { y: 22, autoAlpha: 0, skewY: 3 });
      setIf('[data-login-module]',      { y: 14, autoAlpha: 0, scale: 0.94 });
      setIf('[data-login-card]',        { scale: 0.94, autoAlpha: 0, clipPath: 'inset(10% 6% 10% 6% round 24px)' });
      setIf('[data-login-card-line]',   { scaleX: 0, transformOrigin: 'left center' });
      setIf('[data-login-title]',       { y: 18, autoAlpha: 0 });
      setIf('[data-login-field]',       { y: 12, autoAlpha: 0, scale: 0.99 });
      setIf('[data-login-mesh]',        { scale: 1.25, autoAlpha: 0, rotation: -10 });
      setIf('[data-login-dust]',        { scale: 0, autoAlpha: 0 });

      /* ── TIEMPOS ─────────────────────────────────────────────── */
      const cardIn  = 0.55;
      const scanAt  = cardIn + 0.95;
      const scanEnd = scanAt + SWEEP;
      const hitAt   = scanEnd + 0.05;
      const okAt    = hitAt  + 0.18;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      /* — Fondo — */
      addToIf(tl, '[data-login-iris]', { clipPath: 'circle(150% at 50% 45%)', duration: 1.2, ease: 'power2.inOut' }, 0);
      addToIf(tl, '[data-login-mesh]', { scale: 1, autoAlpha: 1, rotation: 0, duration: 1.3, stagger: 0.12, ease: 'power2.out' }, 0.1);
      addToIf(tl, '[data-login-dust]', { scale: 1, autoAlpha: 0.4, duration: 0.9, stagger: { amount: 0.4, from: 'random' }, ease: 'power2.out' }, 0.3);
      addToIf(tl, '[data-login-iris]', { autoAlpha: 0, duration: 0.4 }, 0.85);

      /* — Layout — */
      addToIf(tl, '[data-login-hero-split]',  { x: 0, autoAlpha: 1, duration: 0.95, ease: 'expo.out' }, 0.18);
      addToIf(tl, '[data-login-panel-split]', { x: 0, autoAlpha: 1, duration: 0.95, ease: 'expo.out' }, 0.22);
      addToIf(tl, '[data-login-brand]',      { autoAlpha: 1, duration: 0.36 }, 0.28);
      addToIf(tl, '[data-login-brand-mark]', { scale: 1, y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.4)' }, 0.3);
      addToIf(tl, '[data-login-brand-line]', { y: 0, autoAlpha: 1, duration: 0.44, ease: 'power3.out' }, 0.46);

      /* — Escena — */
      addToIf(tl, '[data-login-visual]',              { autoAlpha: 1, duration: 0.3 }, 0.34);
      addToIf(tl, '[data-login-visual-inner]',        { scale: 1, y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out' }, 0.36);
      addToIf(tl, '[data-login-visual-halo]',         { scale: 1.15, autoAlpha: 1, duration: 1.0, ease: 'power2.out' }, 0.4);
      addToIf(tl, '[data-login-visual-glow-ring]',    { scale: 1.08, autoAlpha: 1, duration: 1.0, ease: 'power2.out' }, 0.42);
      addToIf(tl, '[data-login-visual-pulse-ring]',   { scale: 1.12, autoAlpha: 0.65, duration: 1.05, ease: 'sine.out' }, 0.44);
      addToIf(tl, '[data-login-visual-scanner]',      { scale: 1, rotationX: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out' }, 0.46);
      addToIf(tl, '.login-carnet-scanner__corner',    { scale: 1, autoAlpha: 1, duration: 0.4, stagger: 0.06, ease: 'back.out(1.6)' }, 0.54);

      /* — Carnet entra con profundidad y se asienta suave — */
      addToIf(tl, '[data-login-visual-card]', {
        y: 0, scale: 1, autoAlpha: 1, rotationY: 0, rotationX: 0,
        duration: 1.1, ease: 'power4.out',
      }, cardIn);

      /* Partes del carnet en cascada suave (solo si el ilustrado las tiene) */
      addToIf(tl, '[data-login-visual-carnet-part="stripe"]', { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power3.out' }, cardIn + 0.18);
      addToIf(tl, '[data-login-visual-carnet-part="header"]', { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, cardIn + 0.24);
      addToIf(tl, '[data-login-visual-carnet-part="chip"]',   { scale: 1, autoAlpha: 1, duration: 0.46, ease: 'back.out(1.5)' }, cardIn + 0.3);
      addToIf(tl, '[data-login-visual-carnet-part="photo"]',  { y: 0, scale: 1, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, cardIn + 0.34);
      addToIf(tl, '[data-login-visual-carnet-part="info"]',   { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, cardIn + 0.42);
      addToIf(tl, '[data-login-visual-carnet-part="foot"]',   { y: 0, autoAlpha: 1, duration: 0.46, ease: 'power3.out' }, cardIn + 0.5);
      addToIf(tl, '[data-login-visual-bars]',         { scaleY: 1, duration: 0.5, ease: 'power3.out' }, cardIn + 0.54);
      addToIf(tl, '[data-login-visual-barcode-zone]', { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, cardIn + 0.58);
      addToIf(tl, '[data-login-visual-edge-glow]',    { autoAlpha: 1, duration: 0.6 }, cardIn + 0.3);
      addToIf(tl, '[data-login-visual-shimmer]',      { autoAlpha: 1, duration: 0.7 }, cardIn + 0.36);

      /* — Inicio de escaneo: brillo de barrido (sin sacudidas) — */
      addToIf(tl, '[data-login-visual-scan-overlay]', { autoAlpha: 0.34, duration: 0.3, ease: 'sine.inOut' }, scanAt - 0.1);

      /* — Barrido láser fluido de arriba-abajo — */
      addSetIf(tl, '[data-login-visual-card-scanline]',  { top: '0%', autoAlpha: 1 }, scanAt);
      addToIf(tl, '[data-login-visual-card-scanline]', {
        top: 'calc(100% - 3px)', duration: SWEEP, ease: 'sine.inOut',
      }, scanAt);
      addToIf(tl, '[data-login-visual-scan-overlay]',    { autoAlpha: 0.06, duration: 0.35, ease: 'sine.inOut' }, scanEnd - 0.1);
      addToIf(tl, '[data-login-visual-card-scanline]',   { autoAlpha: 0, duration: 0.25 }, scanEnd);

      /* — Lectura del barcode: destello limpio — */
      addToIf(tl, '[data-login-visual-barcode-zone]', { scale: 1.05, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut' }, hitAt - 0.05);
      addToIf(tl, BEAM_SEL, { left: 'calc(100% - 3px)', duration: 0.28, ease: 'power2.inOut' }, hitAt);
      addToIf(tl, '[data-login-visual-spark]', {
        autoAlpha: 1, scale: 1.2,
        duration: 0.18, stagger: { amount: 0.16, from: 'center' },
        yoyo: true, repeat: 1, ease: 'sine.out',
      }, hitAt + 0.05);
      addSetIf(tl, BEAM_SEL, { left: '0%' }, hitAt + 0.34);

      /* — Confirmación de éxito — */
      addToIf(tl, '[data-login-visual-scan-overlay]', { autoAlpha: 0, duration: 0.3 }, okAt - 0.04);
      addToIf(tl, '[data-login-visual-flash]',        { autoAlpha: 0.7, duration: 0.14, ease: 'sine.out' }, okAt);
      addToIf(tl, '[data-login-visual-flash]',        { autoAlpha: 0, duration: 0.55, ease: 'sine.inOut' }, okAt + 0.14);
      addToIf(tl, '[data-login-visual-success-ring]', {
        autoAlpha: 0.85, scale: 3.0, duration: 0.9, ease: 'power2.out',
      }, okAt);
      addToIf(tl, '[data-login-visual-success-ring]', { autoAlpha: 0, duration: 0.5, ease: 'sine.inOut' }, okAt + 0.6);
      addToIf(tl, '[data-login-visual-barcode-zone]', {
        borderColor: 'rgba(52,211,153,0.85)',
        boxShadow: '0 0 32px rgba(52,211,153,0.5)',
        duration: 0.5, ease: 'power2.out',
      }, okAt + 0.1);

      /* — Formulario (panel derecho) — */
      addToIf(tl, '[data-login-hero-title]', { y: 0, skewY: 0, autoAlpha: 1, duration: 0.65, ease: 'power3.out' }, 0.62);
      addToIf(tl, '[data-login-module]',     { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out' }, 0.7);
      addToIf(tl, '[data-login-mobile-intro]', { autoAlpha: 1, duration: 0.4 }, 0.34);
      addToIf(tl, '[data-login-card]', { scale: 1, autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 0.8, ease: 'power3.out' }, 0.42);
      addToIf(tl, '[data-login-card-line]', { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, 0.52);
      addToIf(tl, '[data-login-title]', { y: 0, autoAlpha: 1, duration: 0.5, ease: 'power3.out' }, 0.56);
      addToIf(tl, '[data-login-field]', { y: 0, scale: 1, autoAlpha: 1, duration: 0.44, stagger: 0.07, ease: 'power3.out' }, 0.62);

      scopeRef.current?.classList.add('login-page--gsap-ready');
    },
    { scope: scopeRef }
  );
}
