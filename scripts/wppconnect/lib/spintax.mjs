/**
 * Spintax: "{opción A|opción B|opción C}" → elige una al azar (anidado).
 */
export function spin(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  const re = /\{([^{}]+)\}/;

  for (let i = 0; i < 64 && re.test(result); i++) {
    result = result.replace(re, (_, inner) => {
      const parts = inner.split('|').map((p) => p.trim()).filter(Boolean);
      if (!parts.length) return '';
      return parts[Math.floor(Math.random() * parts.length)];
    });
  }
  return result;
}
