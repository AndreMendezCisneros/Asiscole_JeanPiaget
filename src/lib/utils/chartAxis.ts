/** Techo del eje Y en múltiplos “redondos” (evita 0-20-40-68). */
export function niceAxisScale(maxValue: number, divisions = 4): { max: number; ticks: number[] } {
  const padded = Math.max(4, maxValue);
  const rawStep = padded / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
  const residual = rawStep / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const step = Math.max(1, niceResidual * magnitude);
  const max = step * Math.ceil(padded / step);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}
