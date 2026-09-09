import { gsap } from 'gsap';

/** Nodos del selector (respeta el `scope` de useGSAP) o null si no hay ninguno. */
export function gsapTargets(selector: string): Element[] | null {
  const nodes = gsap.utils.toArray<Element>(selector);
  return nodes.length > 0 ? nodes : null;
}

export function setIf(selector: string, vars: gsap.TweenVars): void {
  const nodes = gsapTargets(selector);
  if (nodes) gsap.set(nodes, vars);
}

export function toIf(selector: string, vars: gsap.TweenVars) {
  const nodes = gsapTargets(selector);
  return nodes ? gsap.to(nodes, vars) : null;
}

export function addToIf(
  tl: gsap.core.Timeline,
  selector: string,
  vars: gsap.TweenVars,
  position?: number | string,
): void {
  const nodes = gsapTargets(selector);
  if (nodes) tl.to(nodes, vars, position);
}

export function addSetIf(
  tl: gsap.core.Timeline,
  selector: string,
  vars: gsap.TweenVars,
  position?: number | string,
): void {
  const nodes = gsapTargets(selector);
  if (nodes) tl.set(nodes, vars, position);
}
