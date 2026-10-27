export type NotifyResult = { ok: boolean; error: string | null; chatId?: string; skipped?: boolean };

/**
 * Envía una sola vez por clave dentro de `windowMs`.
 *  * La clave se recuerda solo si el envío salió bien: un fallo deja reintentar ya.
 *  * Un segundo intento simultáneo (doble escaneo) espera al primero en vez de duplicar.
 */
export function createNotifyOnce(windowMs: number, now: () => number = Date.now) {
  const sentAt = new Map<string, number>();
  const inflight = new Map<string, Promise<NotifyResult>>();

  return async function sendOncePerKey(
    key: string,
    chatId: string | undefined,
    send: () => Promise<NotifyResult>,
  ): Promise<NotifyResult> {
    const last = sentAt.get(key);
    if (last != null && now() - last < windowMs) {
      return { ok: true, error: null, skipped: true, chatId };
    }
    const pending = inflight.get(key);
    if (pending) {
      const result = await pending;
      return result.ok ? { ...result, skipped: true } : result;
    }
    const run = send();
    inflight.set(key, run);
    try {
      const result = await run;
      if (result.ok) sentAt.set(key, now());
      return result;
    } finally {
      inflight.delete(key);
    }
  };
}
