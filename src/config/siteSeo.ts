/** Metadatos SEO centralizados — asiscole.com / Colegio Jean Piaget */
export const SITE_URL = 'https://asiscole.com';

/** Imagen única para vista previa de enlaces en WhatsApp (JPEG ligero, no SVG). */
export const WHATSAPP_PREVIEW_VERSION = '1';
export const WHATSAPP_PREVIEW_IMAGE = `${SITE_URL}/whatsapp-preview.jpg?v=${WHATSAPP_PREVIEW_VERSION}`;

/** @deprecated Usar WHATSAPP_PREVIEW_IMAGE — se mantiene por compatibilidad. */
export const OG_IMAGE_URL = WHATSAPP_PREVIEW_IMAGE;

export const SITE_NAME = 'SIE Asiscole';

export const SCHOOL_NAME = 'Colegio Jean Piaget';
export const SCHOOL_SHORT = 'Jean Piaget';
export const SCHOOL_LOCATION = 'Ayacucho - Huamanga';

export const DEFAULT_TITLE =
  'SIE Asiscole | Sistema de Incidencias y Asistencia Escolar — Colegio Jean Piaget';

export const DEFAULT_DESCRIPTION =
  'Plataforma web para gestión de incidencias disciplinarias, control de asistencia escolar, registro por código de barras, semáforo de reincidencia y reportes para el Colegio Jean Piaget.';

export const DEFAULT_KEYWORDS =
  'incidencias escolares, asistencia escolar, control de faltas, Colegio Jean Piaget, Asiscole, SIE, gestión educativa, portal padres';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

export const PUBLIC_ROUTE_META: Record<string, PageMeta> = {
  '/login': {
    title: 'Iniciar sesión | SIE Asiscole — Colegio Jean Piaget',
    description:
      'Acceso seguro al Sistema de Incidencias Escolares (SIE) para personal docente, tutores y administración del Colegio Jean Piaget.',
    canonical: `${SITE_URL}/login`,
  },
  '/portal-padres': {
    title: 'Portal de padres | Consulta de asistencia — Colegio Jean Piaget',
    description:
      'Consulte la asistencia diaria de su hijo o hija en el Colegio Jean Piaget ingresando el DNI del estudiante.',
    canonical: `${SITE_URL}/portal-padres`,
  },
};

export const ARRIVAL_ROUTE_META: PageMeta = {
  title: 'Consulta de asistencia | Colegio Jean Piaget — Asiscole',
  description:
    'Registro de llegada del estudiante. Consulte la asistencia diaria en el Sistema de Incidencias Escolares del Colegio Jean Piaget.',
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
  '/audit',
  '/system-config',
  '/arrival-control',
  '/departure-control',
  '/parent-meetings',
  '/parent-portal',
  '/justify-faults',
];
