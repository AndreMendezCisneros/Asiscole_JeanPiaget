import { afterEach, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { addSetIf, addToIf, gsapTargets, setIf, toIf } from './gsapTargets';

describe('gsapTargets', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve null y no anima si el selector no existe', () => {
    vi.spyOn(gsap.utils, 'toArray').mockReturnValue([]);
    const setSpy = vi.spyOn(gsap, 'set').mockImplementation(() => undefined as never);
    const toSpy = vi.spyOn(gsap, 'to').mockImplementation(() => undefined as never);
    expect(gsapTargets('[data-login-visual-scan-overlay]')).toBeNull();
    setIf('[data-login-visual-scan-overlay]', { autoAlpha: 0 });
    expect(toIf('[data-login-visual-scan-overlay]', { autoAlpha: 1 })).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
    expect(toSpy).not.toHaveBeenCalled();
  });

  it('anima cuando hay nodos', () => {
    const nodes = [{ tagName: 'DIV' }] as unknown as Element[];
    vi.spyOn(gsap.utils, 'toArray').mockReturnValue(nodes);
    const setSpy = vi.spyOn(gsap, 'set').mockImplementation(() => undefined as never);
    const toSpy = vi.spyOn(gsap, 'to').mockImplementation(() => undefined as never);
    expect(gsapTargets('[data-login-visual-card]')).toEqual(nodes);
    setIf('[data-login-visual-card]', { autoAlpha: 0 });
    toIf('[data-login-visual-card]', { autoAlpha: 1 });
    expect(setSpy).toHaveBeenCalledWith(nodes, { autoAlpha: 0 });
    expect(toSpy).toHaveBeenCalledWith(nodes, { autoAlpha: 1 });
  });

  it('no llama timeline.to / timeline.set si no hay nodos', () => {
    vi.spyOn(gsap.utils, 'toArray').mockReturnValue([]);
    const tl = { to: vi.fn(), set: vi.fn() };
    addToIf(tl as never, '[data-missing]', { autoAlpha: 1 }, 0);
    addSetIf(tl as never, '[data-missing]', { autoAlpha: 0 }, 0);
    expect(tl.to).not.toHaveBeenCalled();
    expect(tl.set).not.toHaveBeenCalled();
  });
});
