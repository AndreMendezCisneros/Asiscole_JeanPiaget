/**
 * Assets de marca SIE/Guardy.
 *
 * - UI del sistema: SVG (favicon.svg) — nítido en sidebar, login, etc.
 * - WhatsApp / Open Graph: solo PNG (og-image.png) — el crawler no usa SVG.
 *
 * No usar guardy-mark.png (asset Lovable heredado).
 */
/** Escudo vectorial para componentes de la app */
export const BRAND_ICON_SVG = '/favicon.svg';

/** Logo completo (escudo + wordmark) — solo hero/login */
export const BRAND_LOGIN_LOGO = '/guardy-logo.png';

/** PNG para favicon del navegador y PWA */
export const BRAND_ICON_SM = '/favicon-192.png';
export const BRAND_ICON_MD = '/favicon-512.png';

/** Vista previa al compartir enlaces (WhatsApp) — JPEG fijo, nunca SVG */
export const BRAND_WHATSAPP_PREVIEW = '/whatsapp-preview.jpg';

/** Reportes PDF/Excel */
export const BRAND_WATERMARK = '/guardy-watermark.png';
export const BRAND_REPORT_LOGO = '/guardy-report-logo.png';
