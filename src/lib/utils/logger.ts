/**
 * Logger seguro para producción.
 *
 * OWASP A09:2025 — Security Logging and Alerting Failures
 *
 * En producción:
 *  - log() e info() se suprimen completamente (evitan filtrar datos en DevTools).
 *  - warn() y error() se mantienen pero sin datos adjuntos (solo mensaje).
 *
 * En desarrollo:
 *  - Todos los niveles funcionan con salida completa.
 */
const IS_DEV = import.meta.env.DEV;

function safeMessage(args: unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : '[object]'))
    .join(' ');
}

export const logger = {
  /** Solo visible en desarrollo. Nunca imprime en producción. */
  log(...args: unknown[]): void {
    if (IS_DEV) console.log(...args);
  },

  /** Solo visible en desarrollo. */
  info(...args: unknown[]): void {
    if (IS_DEV) console.info(...args);
  },

  /**
   * Visible en ambos entornos.
   * En producción: imprime solo el mensaje de texto, sin payload de datos.
   */
  warn(...args: unknown[]): void {
    if (IS_DEV) {
      console.warn(...args);
    } else {
      console.warn('[SIE]', safeMessage(args));
    }
  },

  /**
   * Visible en ambos entornos.
   * En producción: imprime solo el mensaje de texto, sin payload de datos.
   * Nunca incluye tokens, respuestas de API ni datos de usuario.
   */
  error(...args: unknown[]): void {
    if (IS_DEV) {
      console.error(...args);
    } else {
      console.error('[SIE]', safeMessage(args));
    }
  },
} as const;
