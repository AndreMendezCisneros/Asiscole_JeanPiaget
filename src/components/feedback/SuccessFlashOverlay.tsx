import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { subscribeSuccessFlash, type SuccessFlashPayload } from '@/lib/utils/successFlashBus';
import { cn } from '@/lib/utils';

const VISIBLE_MS = 1400;
const FADE_MS = 320;

export function SuccessFlashOverlay() {
  const [payload, setPayload] = useState<SuccessFlashPayload | null>(null);
  const [phase, setPhase] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    return subscribeSuccessFlash((next) => {
      setPayload(next);
    });
  }, []);

  useEffect(() => {
    if (!payload) {
      setPhase(null);
      return;
    }

    setPhase('in');

    const fadeTimer = window.setTimeout(() => setPhase('out'), VISIBLE_MS);
    const clearTimer = window.setTimeout(() => {
      setPayload(null);
      setPhase(null);
    }, VISIBLE_MS + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [payload]);

  if (!payload) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={cn(
          'success-flash-card flex max-w-sm flex-col items-center gap-2 rounded-2xl border-2 border-[hsl(var(--success))] bg-white px-8 py-7 text-center shadow-2xl',
          phase === 'in' && 'success-flash-card--in',
          phase === 'out' && 'success-flash-card--out'
        )}
      >
        <div className="success-flash-icon flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))] text-white">
          <Check className="h-9 w-9 stroke-[3]" aria-hidden />
        </div>
        <p className="text-lg font-bold text-[hsl(152_40%_22%)]">{payload.title}</p>
        {payload.description ? (
          <p className="text-sm text-muted-foreground leading-snug">{payload.description}</p>
        ) : null}
      </div>
    </div>
  );
}
