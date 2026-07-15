/**
 * Utilidades de sanitización — OWASP A05:2025 Injection / A04 Cryptographic Failures
 *
 * Principios:
 *  - text()   : elimina TODAS las etiquetas HTML (no solo <script>/<iframe>).
 *               La regex de lista blanca es bypasseable; se usa strip-all en su lugar.
 *  - html()   : convierte caracteres peligrosos a entidades HTML seguras.
 *  - search() : escapa metacaracteres de LIKE/ILIKE para prevenir SQL injection.
 */

/** Elimina todas las etiquetas HTML del string. */
function stripAllTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

export const sanitize = {
  /**
   * Sanitizar HTML para inserción en el DOM.
   * Convierte caracteres especiales a entidades HTML; el texto resulta seguro
   * incluso si se usa como innerHTML (aunque se prefiere textContent).
   */
  html(input: string): string {
    if (!input || typeof input !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  },

  /**
   * Sanitizar texto plano para inputs, búsquedas y almacenamiento.
   *
   * CORRECCIÓN A05: Antes se usaba un regex de lista negra para <script> e <iframe>,
   * que es bypasseable (ej. <scr<script>ipt>alert(1)</scr</script>ipt>).
   * Ahora se eliminan TODAS las etiquetas sin excepción.
   */
  text(input: string, maxLength?: number): string {
    if (!input || typeof input !== 'string') return '';
    let sanitized = stripAllTags(input).trim();
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    return sanitized;
  },

  /**
   * Sanitizar para búsquedas ILIKE en PostgreSQL.
   * Escapa metacaracteres de LIKE: %, _, \.
   */
  search(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .trim();
  },

  /** Valida y normaliza un email. Devuelve null si el formato es inválido. */
  email(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
  },

  /** Solo enteros positivos. */
  positiveInteger(input: string | number): number | null {
    if (typeof input === 'number') {
      return Number.isInteger(input) && input > 0 ? input : null;
    }
    if (typeof input !== 'string') return null;
    const num = parseInt(input, 10);
    return !isNaN(num) && num > 0 ? num : null;
  },

  /**
   * Sanitizar URLs: solo http y https.
   * Previene javascript: y data: URIs (A05 — Open Redirect / XSS).
   */
  url(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    try {
      const url = new URL(input);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.toString();
      }
      return null;
    } catch {
      return null;
    }
  },

  /** Solo caracteres alfanuméricos para códigos de barra. */
  barcode(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const sanitized = input.trim().replace(/[^a-zA-Z0-9]/g, '');
    return sanitized.length > 0 ? sanitized : null;
  },

  /**
   * Valida contraseñas.
   * Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.
   * OWASP A07 — Authentication Failures.
   */
  password(input: string): { valid: boolean; error: string | null } {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'La contraseña es requerida.' };
    }
    if (input.length < 8) {
      return { valid: false, error: 'Mínimo 8 caracteres.' };
    }
    if (!/[A-Z]/.test(input)) {
      return { valid: false, error: 'Debe incluir al menos una mayúscula.' };
    }
    if (!/[a-z]/.test(input)) {
      return { valid: false, error: 'Debe incluir al menos una minúscula.' };
    }
    if (!/[0-9]/.test(input)) {
      return { valid: false, error: 'Debe incluir al menos un número.' };
    }
    return { valid: true, error: null };
  },
};
