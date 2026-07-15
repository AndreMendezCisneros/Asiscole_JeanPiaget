/**
 * Rate Limiter para prevenir ataques de fuerza bruta
 */

interface AttemptRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private attempts: Map<string, AttemptRecord> = new Map();
  private readonly defaultWindowMs: number;
  private readonly defaultMaxAttempts: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.defaultMaxAttempts = maxAttempts;
    this.defaultWindowMs = windowMs;
  }

  /**
   * Verificar si se permite el intento
   * @param key Identificador único (ej: IP, username)
   * @param maxAttempts Número máximo de intentos (opcional, usa default si no se especifica)
   * @param windowMs Ventana de tiempo en ms (opcional, usa default si no se especifica)
   * @returns true si se permite, false si está bloqueado
   */
  check(key: string, maxAttempts?: number, windowMs?: number): boolean {
    const now = Date.now();
    const max = maxAttempts || this.defaultMaxAttempts;
    const window = windowMs || this.defaultWindowMs;
    
    const record = this.attempts.get(key);

    // Si no hay registro o la ventana expiró, crear nuevo
    if (!record || now > record.resetAt) {
      this.attempts.set(key, {
        count: 1,
        resetAt: now + window
      });
      return true;
    }

    // Si ya alcanzó el máximo, bloquear
    if (record.count >= max) {
      return false;
    }

    // Incrementar contador
    record.count++;
    this.attempts.set(key, record);
    return true;
  }

  /**
   * Obtener número de intentos restantes
   */
  getRemainingAttempts(key: string, maxAttempts?: number): number {
    const max = maxAttempts || this.defaultMaxAttempts;
    const record = this.attempts.get(key);
    
    if (!record || Date.now() > record.resetAt) {
      return max;
    }
    
    return Math.max(0, max - record.count);
  }

  /**
   * Obtener tiempo hasta que se resetee el contador
   */
  getTimeUntilReset(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;
    
    const remaining = record.resetAt - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Resetear contador para una clave
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Limpiar registros expirados
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.resetAt) {
        this.attempts.delete(key);
      }
    }
  }
}

// Instancias preconfiguradas
export const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 intentos en 15 minutos
export const apiRateLimiter = new RateLimiter(100, 60 * 1000); // 100 requests por minuto
export const passwordResetRateLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 intentos por hora

// Limpiar registros expirados cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    loginRateLimiter.cleanup();
    apiRateLimiter.cleanup();
    passwordResetRateLimiter.cleanup();
  }, 5 * 60 * 1000);
}

