/** Metadatos SEO centralizados — mariscalcaceres.asiscole.com */
export const SITE_URL = 'https://mariscalcaceres.asiscole.com';

/** Imagen única para vista previa de enlaces en WhatsApp (JPEG ligero, no SVG). */
export const WHATSAPP_PREVIEW_VERSION = '1';
export const WHATSAPP_PREVIEW_IMAGE = `${SITE_URL}/whatsapp-preview.jpg?v=${WHATSAPP_PREVIEW_VERSION}`;

/** @deprecated Usar WHATSAPP_PREVIEW_IMAGE — se mantiene por compatibilidad. */
export const OG_IMAGE_URL = WHATSAPP_PREVIEW_IMAGE;

export const SITE_NAME = 'SIE Mariscal Cáceres';

export const SCHOOL_NAME = 'Institución Educativa Emblemática Mariscal Cáceres';
export const SCHOOL_SHORT = 'Mariscal Cáceres';
export const SCHOOL_LOCATION = 'Ayacucho - Huamanga';

export const DEFAULT_TITLE =
  'SIE | Sistema de Incidencias y Asistencia Escolar — Mariscal Cáceres';

export const DEFAULT_DESCRIPTION =
  'Plataforma web para gestión de incidencias disciplinarias, control de asistencia escolar, registro por código de barras, semáforo de reincidencia y reportes para la Institución Educativa Emblemática Mariscal Cáceres.';

export const DEFAULT_KEYWORDS =
  'incidencias escolares, asistencia escolar, control de faltas, Mariscal Cáceres, GUE, SIE, gestión educativa, portal padres, Ayacucho';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

export const PUBLIC_ROUTE_META: Record<string, PageMeta> = {
  '/login': {
    title: 'Iniciar sesión | SIE — Mariscal Cáceres',
    description:
      'Acceso seguro al Sistema de Incidencias Escolares (SIE) para personal docente, tutores y administración de la Institución Educativa Emblemática Mariscal Cáceres.',
    canonical: `${SITE_URL}/login`,
  },
  '/portal-padres': {
    title: 'Portal de padres | Consulta de asistencia — Mariscal Cáceres',
    description:
      'Consulte la asistencia diaria de su hijo o hija en Mariscal Cáceres ingresando el número del carnet institucional.',
    canonical: `${SITE_URL}/portal-padres`,
  },
};

export const ARRIVAL_ROUTE_META: PageMeta = {
  title: 'Consulta de asistencia | Mariscal Cáceres — SIE',
  description:
    'Registro de llegada del estudiante. Consulte la asistencia diaria en el Sistema de Incidencias Escolares de Mariscal Cáceres.',
  canonical: `${SITE_URL}/portal-padres`,
};

export const DEFAULT_PAGE_META: PageMeta = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  canonical: `${SITE_URL}/`,
};

/** Rutas internas que no deben indexarse (requieren autenticación). */
export const NOINDEX_PREFIXES = [
  '/dashboard',
  '/tutor-scanner',
  '/register',
  '/incidents',
  '/students',
  '/faults',
  '/reports',
  '/attendance-report',
  '/integral-report',
  '/audit',
  '/system-config',
  '/arrival-control',
  '/departure-control',
  '/parent-meetings',
  '/parent-portal',
  '/justify-faults',
  '/justify-attendance',
];
