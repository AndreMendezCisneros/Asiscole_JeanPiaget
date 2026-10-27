/**
 * Monitoreo de errores (Sentry) y grabación de sesiones (OpenReplay).
 *
 * Solo se activa en los colegios cuyo .env.build trae las variables:
 *   VITE_SENTRY_DSN          → errores a Sentry
 *   VITE_OPENREPLAY_KEY      → grabaciones a OpenReplay
 *   VITE_OPENREPLAY_INGEST   → p. ej. https://replay.asiscole.com/ingest
 * Sin ellas no se descarga ni se envía nada. Cualquier fallo del monitoreo se ignora:
 * nunca debe afectar al SIE.
 *
 * Privacidad (datos de menores): solo se graba al personal, nunca al portal de padres
 * ni a vistas públicas; los textos se ven pero DNI, celulares y correos van ocultos,
 * y no se capturan peticiones de red. Sentry no recibe IP, nombres, cookies ni cuerpos (dataCollection).
 */
import type { User } from '@/types';

type SentryModule = typeof import('@sentry/react');
type ReplayTracker = import('@openreplay/tracker').default;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN?.trim();
const REPLAY_KEY = import.meta.env.VITE_OPENREPLAY_KEY?.trim();
const REPLAY_INGEST = import.meta.env.VITE_OPENREPLAY_INGEST?.trim();

/** Rutas que nunca se graban (padres y vistas públicas). */
const RUTAS_SIN_GRABAR = ['/portal-padres', '/parent-portal', '/llegada', '/login', '/cambiar-password'];

let sentry: SentryModule | null = null;
let tracker: ReplayTracker | null = null;
let trackerLoading: Promise<ReplayTracker | null> | null = null;
let grabando = false;

export function initMonitoring(): void {
  if (!SENTRY_DSN) return;
  import('@sentry/react')
    .then((mod) => {
      mod.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_BUILD_ID || undefined,
        // Sin IP, cookies, cabeceras, cuerpos ni parámetros de URL.
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
        // Las grabaciones las hace OpenReplay.
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        tracesSampleRate: 0,
        initialScope: { tags: { colegio: import.meta.env.VITE_SCHOOL_NAME || 'sin-nombre' } },
      });
      sentry = mod;
    })
    .catch(() => undefined);
}

/** Envía a Sentry un error capturado (ErrorBoundary, catch importantes). */
export function reportError(error: unknown, extra?: Record<string, unknown>): void {
  try {
    sentry?.captureException(error, extra ? { extra } : undefined);
  } catch {
    // el monitoreo nunca rompe el SIE
  }
}

function puedeGrabar(user: User | null, pathname: string): boolean {
  if (!user || user.role === 'Padre') return false;
  return !RUTAS_SIN_GRABAR.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** DNI (8 dígitos) y celulares (9 dígitos) se reemplazan por asteriscos en todo texto grabado. */
const DNI_O_CELULAR = /\b\d{8,9}\b/g;

/**
 * Engancha el enmascarado de DNI al sanitizador interno del tracker (@openreplay/tracker 19.0.2,
 * versión fijada). Si la versión cambia y el gancho no existe, no se graba: es preferible a
 * grabar DNI a la vista.
 */
function ocultarDniEnTextos(t: ReplayTracker): boolean {
  const sanitizer = (t as unknown as { app?: { sanitizer?: { sanitize?: (id: number, data: string) => string } } })
    .app?.sanitizer;
  const original = sanitizer?.sanitize?.bind(sanitizer);
  if (!sanitizer || !original) return false;
  sanitizer.sanitize = (id, data) => original(id, data).replace(DNI_O_CELULAR, (m) => '*'.repeat(m.length));
  return true;
}

function cargarTracker(): Promise<ReplayTracker | null> {
  if (!REPLAY_KEY || !REPLAY_INGEST) return Promise.resolve(null);
  trackerLoading ??= import('@openreplay/tracker')
    .then(({ default: Tracker }) => {
      const t = new Tracker({
        projectKey: REPLAY_KEY,
        ingestPoint: REPLAY_INGEST,
        // Textos visibles; en campos se ocultan valores con 4+ dígitos (DNI, teléfono) y correos.
        defaultInputMode: 0,
        obscureInputNumbers: true,
        obscureInputEmails: true,
        obscureTextEmails: true,
        network: { capturePayload: false, failuresOnly: true, ignoreHeaders: true, sessionTokenHeader: false },
        consoleMethods: ['error'],
      } as ConstructorParameters<typeof Tracker>[0]);
      if (!ocultarDniEnTextos(t)) return null;
      tracker = t;
      return tracker;
    })
    .catch(() => null);
  return trackerLoading;
}

/** Enciende o apaga la grabación según el usuario y la ruta actual. */
export async function syncSessionReplay(user: User | null, pathname: string): Promise<void> {
  try {
    if (!puedeGrabar(user, pathname)) {
      if (grabando && tracker) {
        tracker.stop();
        grabando = false;
        sentry?.setTag('openReplaySessionURL', undefined);
      }
      return;
    }
    if (grabando) return;
    const t = await cargarTracker();
    if (!t || !user) return;
    grabando = true;
    const res = await t.start({ userID: user.username, metadata: { rol: user.role } });
    if (!res || !('success' in res) || !res.success) {
      grabando = false;
      return;
    }
    const url = t.getSessionURL();
    sentry?.setTag('openReplaySessionURL', url);
    sentry?.setTag('openReplaySession.id', t.getSessionID());
  } catch {
    grabando = false;
  }
}

/** Datos mínimos del usuario en Sentry: id y rol, sin nombre ni correo. */
export function setMonitoringUser(user: User | null): void {
  try {
    sentry?.setUser(user ? { id: String(user.id) } : null);
    sentry?.setTag('rol', user?.role);
  } catch {
    // el monitoreo nunca rompe el SIE
  }
}
