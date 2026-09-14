/** Metadatos SEO — SIE Asis Academy / Academia Sofía (Ayacucho) */
export const SITE_URL = 'https://demostracion.asisacademy.com';

/** Imagen única para vista previa de enlaces en WhatsApp (JPEG ligero, no SVG). */
export const WHATSAPP_PREVIEW_VERSION = '1';
export const WHATSAPP_PREVIEW_IMAGE = `${SITE_URL}/whatsapp-preview.jpg?v=${WHATSAPP_PREVIEW_VERSION}`;

/** @deprecated Usar WHATSAPP_PREVIEW_IMAGE — se mantiene por compatibilidad. */
export const OG_IMAGE_URL = WHATSAPP_PREVIEW_IMAGE;

export const SITE_NAME = 'SIE Asis Academy';

export const SCHOOL_NAME = 'Academia Sofía';
export const SCHOOL_SHORT = 'Academia Sofía';
export const SCHOOL_LOCATION = 'Ayacucho';
export const SCHOOL_TAGLINE = '¡Creemos en la exigencia!';

export const DEFAULT_TITLE =
  'SIE Asis Academy | Incidencias y asistencia — Academia Sofía';

export const DEFAULT_DESCRIPTION =
  'Plataforma web para gestión de incidencias disciplinarias, control de asistencia escolar, registro por código de barras, semáforo de reincidencia y reportes — Academia Sofía, Ayacucho.';

export const DEFAULT_KEYWORDS =
  'incidencias escolares, asistencia escolar, Academia Sofía, Asis Academy, SIE, Ayacucho, portal padres';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
}

export const PUBLIC_ROUTE_META: Record<string, PageMeta> = {
  '/login': {
    title: 'Iniciar sesión | SIE Asis Academy — Academia Sofía',
    description:
      'Acceso seguro al Sistema de Incidencias Escolares (SIE Asis Academy) para personal docente, tutores y administración de Academia Sofía.',
    canonical: `${SITE_URL}/login`,
  },
  '/portal-padres': {
    title: 'Portal de padres | Consulta de asistencia — Academia Sofía',
    description:
      'Consulte la asistencia diaria de su hijo o hija en Academia Sofía ingresando el DNI del estudiante.',
    canonical: `${SITE_URL}/portal-padres`,
  },
};

export const ARRIVAL_ROUTE_META: PageMeta = {
  title: 'Consulta de asistencia | Academia Sofía — Asis Academy',
  description:
    'Registro de llegada del estudiante. Consulte la asistencia diaria en el SIE Asis Academy de Academia Sofía.',
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
