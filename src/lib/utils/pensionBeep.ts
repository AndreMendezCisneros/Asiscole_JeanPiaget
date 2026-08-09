let lastBeepAt = 0;
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AudioCtx();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Desbloquear audio tras gesto del usuario (tablets bloquean Autoplay). */
export async function unlockPensionAudio(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch {
    /* ignore */
  }
}

export function resetPensionBeepThrottleForTests(): void {
  lastBeepAt = 0;
}

/** Pulso corto y agresivo (cuadrada = sonido de alarma electrónica). */
function alarmPulse(
  ctx: AudioContext,
  startAt: number,
  duration: number,
  frequency: number,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc2.type = 'square';
  osc.frequency.setValueAtTime(frequency, startAt);
  // Ligero desafinado → timbre más “antirrobo”
  osc2.frequency.setValueAtTime(frequency * 1.01, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.004);
  gain.gain.setValueAtTime(volume, startAt + Math.max(0.01, duration - 0.015));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc2.start(startAt);
  osc.stop(startAt + duration + 0.01);
  osc2.stop(startAt + duration + 0.01);
}

/** Barrido tipo sirena de pánico (auto / casa). */
function panicWhoop(
  ctx: AudioContext,
  startAt: number,
  duration: number,
  freqFrom: number,
  freqTo: number,
  volume: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freqFrom, startAt);
  osc.frequency.linearRampToValueAtTime(freqTo, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.setValueAtTime(volume, startAt + duration - 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Alarma antirrobo para mora (pánico hi-lo + whoops). No bloquea asistencia.
 */
export function playPensionMorosoBeep(now = Date.now()): void {
  // Evitar solapar alarmas (~2.4s)
  if (now - lastBeepAt < 2500) return;
  lastBeepAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const run = () => {
    try {
      const t0 = ctx.currentTime;
      const vol = 0.45;
      const hi = 1650;
      const lo = 880;
      const pulse = 0.09;
      const gap = 0.02;

      // Ráfaga hi-lo rápida (estilo alarma de auto)
      let t = t0;
      for (let i = 0; i < 10; i++) {
        alarmPulse(ctx, t, pulse, i % 2 === 0 ? hi : lo, vol);
        t += pulse + gap;
      }

      // Sirenas de pánico (whoop up / whoop down)
      panicWhoop(ctx, t, 0.22, 700, 1900, vol);
      panicWhoop(ctx, t + 0.22, 0.22, 1900, 700, vol);
      panicWhoop(ctx, t + 0.44, 0.22, 700, 1900, vol);
      panicWhoop(ctx, t + 0.66, 0.22, 1900, 700, vol);

      // Cierre: 4 pitidos agudos cortos
      const end = t + 0.9;
      for (let i = 0; i < 4; i++) {
        alarmPulse(ctx, end + i * 0.12, 0.08, 2000, vol);
      }
    } catch {
      /* tablet sin audio — solo UI */
    }
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => {
      /* ignore */
    });
  } else {
    run();
  }
}

/**
 * Pitido de aviso (no bloquea asistencia).
 * Activo si el cache indica moroso (pagado=0 tras día siguiente al vencimiento).
 */
export function shouldAlertPensionMorosa(
  estado: string | undefined | null,
  avisoActivo: boolean,
): boolean {
  if (!avisoActivo) return false;
  return estado === 'moroso';
}
