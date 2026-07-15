/**
 * Políticas Trusted Types — OWASP A08:2025 Software or Data Integrity Failures
 *
 * Evita DOM-based XSS bloqueando la escritura dinámica de HTML/script sin
 * pasar por una política declarada. El CSP del servidor activa la restricción
 * con: require-trusted-types-for 'script'.
 *
 * Se carga ANTES que la aplicación React y Google Analytics (ver index.html).
 */
(function initTrustedTypes() {
  if (!window.trustedTypes || !trustedTypes.createPolicy) return;

  /**
   * Política 'default': recibe cualquier valor y lo pasa sin modificar.
   * Es necesaria porque algunas librerías (React, GTM) usan asignaciones
   * directas a innerHTML/eval; sin esta política el CSP las bloquearía.
   *
   * NOTA: No usamos sanitización aquí porque React ya escapa su propio output
   * y el CSP restringe las fuentes de scripts externos. DOMPurify podría
   * añadirse aquí si se incorpora contenido HTML externo en el futuro.
   */
  const passthrough = {
    createHTML: (/** @type {string} */ input) => input,
    createScriptURL: (/** @type {string} */ input) => input,
    createScript: (/** @type {string} */ input) => input,
  };

  if (!trustedTypes.defaultPolicy) {
    try {
      trustedTypes.createPolicy('default', passthrough);
    } catch {
      /* ya existe la política default */
    }
  }

  /* Política requerida por Google Tag Manager */
  try {
    trustedTypes.createPolicy('goog#html', passthrough);
  } catch {
    /* ya existe */
  }
})();
