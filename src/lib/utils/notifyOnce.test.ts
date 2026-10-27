import { describe, expect, it, vi } from 'vitest';
import { createNotifyOnce, type NotifyResult } from './notifyOnce';

const ok: NotifyResult = { ok: true, error: null };
const fail: NotifyResult = { ok: false, error: 'red caída' };

describe('createNotifyOnce', () => {
  it('un envío fallido no bloquea el reintento inmediato', async () => {
    const once = createNotifyOnce(120_000);
    const send = vi.fn<() => Promise<NotifyResult>>().mockResolvedValueOnce(fail).mockResolvedValueOnce(ok);
    expect(await once('cita:1:5', undefined, send)).toEqual(fail);
    expect(await once('cita:1:5', undefined, send)).toEqual(ok);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('tras un envío exitoso omite repetidos dentro de la ventana y reenvía después', async () => {
    let t = 0;
    const once = createNotifyOnce(1000, () => t);
    const send = vi.fn(async () => ok);
    await once('k', 'chat', send);
    expect(await once('k', 'chat', send)).toEqual({ ok: true, error: null, skipped: true, chatId: 'chat' });
    t = 1500;
    await once('k', 'chat', send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('dos intentos simultáneos envían una sola vez', async () => {
    const once = createNotifyOnce(120_000);
    let resolve!: (r: NotifyResult) => void;
    const send = vi.fn(() => new Promise<NotifyResult>((r) => (resolve = r)));
    const a = once('k', undefined, send);
    const b = once('k', undefined, send);
    resolve(ok);
    expect(await a).toEqual(ok);
    expect(await b).toEqual({ ...ok, skipped: true });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('claves distintas no se bloquean entre sí', async () => {
    const once = createNotifyOnce(120_000);
    const send = vi.fn(async () => ok);
    await once('a', undefined, send);
    await once('b', undefined, send);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
