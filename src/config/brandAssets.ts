/**
 * Assets de marca Asiscole.
 *
 * - UI del sistema: PNG con transparencia (logo_asiscole_sf.png).
 * - WhatsApp / Open Graph: JPEG (whatsapp-preview.jpg) — el crawler no usa SVG.
 */
/** Marca oficial (escudo + A + birrete, fondo transparente) */
export const BRAND_MARK = '/logo_asiscole_sf.png';

/** Escudo para componentes compactos (sidebar, cabeceras) */
export const BRAND_ICON_SVG = BRAND_MARK;

/** Logo completo — login y pie de formulario */
export const BRAND_LOGIN_LOGO = BRAND_MARK;

/** PNG para favicon del navegador y PWA */
export const BRAND_ICON_SM = '/favicon-192.png';
export const BRAND_ICON_MD = '/favicon-512.png';

/** Vista previa al compartir enlaces (WhatsApp) — JPEG fijo, nunca SVG */
export const BRAND_WHATSAPP_PREVIEW = '/whatsapp-preview.jpg';

/** Reportes PDF/Excel */
export const BRAND_WATERMARK = '/guardy-watermark.png';
export const BRAND_REPORT_LOGO = '/guardy-report-logo.png';
