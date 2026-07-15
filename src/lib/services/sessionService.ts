import { User } from '@/types';

interface SessionData {
  user: User;
  apiToken: string;
  expiresAt: number;
  lastActivity: number;
}

const DEFAULT_SESSION_MS = 30 * 60 * 1000;
const TUTOR_SESSION_MS = 15 * 60 * 1000;
const DOCENTE_SESSION_MS = 15 * 60 * 1000;
const PARENT_SESSION_MS = 15 * 60 * 1000;

/**
 * Servicio de gestión de sesiones con expiración por inactividad
 */
export const sessionService = {
  SESSION_DURATION: DEFAULT_SESSION_MS,
  TUTOR_SESSION_DURATION: TUTOR_SESSION_MS,
  PARENT_SESSION_DURATION: PARENT_SESSION_MS,
  /** Tiempo sin interacción antes de ocultar el perfil del alumno en el escáner */
  TUTOR_PROFILE_IDLE_MS: 45 * 1000,
  REFRESH_INTERVAL: 60 * 1000,
  STORAGE_KEY: 'session',

  getIdleDurationMs(role?: User['role']): number {
    if (role === 'Tutor' || role === 'Docente') return TUTOR_SESSION_MS;
    if (role === 'Padre') return PARENT_SESSION_MS;
    return DEFAULT_SESSION_MS;
  },

  /**
   * Guardar sesión con token de API (validado en servidor)
   */
  saveSession(user: User, apiToken: string, expiresInMs?: number): void {
    const now = Date.now();
    const duration = expiresInMs ?? this.getIdleDurationMs(user.role);
    const sessionData: SessionData = {
      user,
      apiToken,
      expiresAt: now + duration,
      lastActivity: now,
    };
    try {
      // sessionStorage se borra automáticamente al cerrar la pestaña/navegador,
      // reduciendo el riesgo en equipos compartidos del colegio.
      // No guardamos 'user' ni 'userId' por separado: toda la sesión vive en una
      // sola entrada y se purga junto con el token al cerrar.
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));

      // Limpiar cualquier dato residual que pudiera quedar de versiones anteriores.
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    } catch (error) {
      console.error('Error al guardar sesión:', error);
    }
  },

  getApiToken(): string | null {
    const session = this.readSessionRaw();
    if (!session?.apiToken) return null;
    if (Date.now() > session.expiresAt) {
      this.clearSession();
      return null;
    }
    return session.apiToken;
  },

  readSessionRaw(): SessionData | null {
    try {
      const sessionStr = sessionStorage.getItem(this.STORAGE_KEY);
      if (!sessionStr) return null;
      const parsed = JSON.parse(sessionStr) as SessionData;
      if (!parsed.apiToken) {
        this.clearSession();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Obtener sesión actual (si no está expirada)
   */
  getSession(): SessionData | null {
    const session = this.readSessionRaw();
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
      this.clearSession();
      return null;
    }

    return session;
  },

  /**
   * Reinicia el temporizador de inactividad (solo ante actividad real del usuario)
   */
  touchActivity(): void {
    const session = this.readSessionRaw();
    if (!session) return;

    if (Date.now() > session.expiresAt) {
      this.clearSession();
      return;
    }

    const now = Date.now();
    const duration = this.getIdleDurationMs(session.user.role);
    session.lastActivity = now;
    session.expiresAt = now + duration;

    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error al actualizar actividad:', error);
    }
  },

  /**
   * Sincroniza la expiración local con la nueva ventana devuelta por el servidor
   * tras renovar el token (sie_renovar_sesion). Mantiene cliente y servidor alineados.
   */
  syncServerExpiry(expiresInMs?: number): void {
    const session = this.readSessionRaw();
    if (!session) return;

    const now = Date.now();
    const duration = expiresInMs ?? this.getIdleDurationMs(session.user.role);
    session.lastActivity = now;
    session.expiresAt = now + duration;

    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error al sincronizar expiración de sesión:', error);
    }
  },

  /** @deprecated Usar touchActivity */
  updateActivity(): void {
    this.touchActivity();
  },

  clearSession(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      // Purgar también entradas de versiones anteriores que usaban localStorage.
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    } catch (error) {
      console.error('Error al limpiar sesión:', error);
    }
  },

  isExpired(): boolean {
    const session = this.readSessionRaw();
    return !session || Date.now() > session.expiresAt;
  },

  getTimeRemaining(): number {
    const session = this.readSessionRaw();
    if (!session) return 0;
    const remaining = session.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000));
  },

  extendSession(): void {
    this.touchActivity();
  },
};
