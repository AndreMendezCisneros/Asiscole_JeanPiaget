import { supabase } from '../supabaseClient';
import { User } from '@/types';
import { sessionService } from './sessionService';
import { resetSupabaseWarmup } from '@/lib/supabaseWarmup';
import { loginRateLimiter } from '@/lib/utils/rateLimit';
import { sanitize } from '@/lib/utils/sanitize';

/**
 * El token de sesión vive en el servidor con una ventana de inactividad (15 min para
 * tutor/padre). Para que NO caduque mientras el tutor sigue escaneando, deslizamos esa
 * ventana en el servidor ante actividad real, pero limitamos la frecuencia de llamadas.
 */
const RENEW_THROTTLE_MS = 4 * 60 * 1000;
let lastRenewAttempt = 0;

interface SieRenewResponse {
  ok?: boolean;
  expiresInMs?: number;
}

interface SieLoginResponse {
  ok: boolean;
  error?: string;
  token?: string;
  expiresInMs?: number;
  user?: {
    id: number;
    username: string;
    fullName: string;
    email: string | null;
    role: User['role'];
    active: boolean;
    gradosAsignados: unknown;
    cambioPasswordObligatorio: boolean;
  };
}

/**
 * Servicio de autenticación
 */
export const authService = {
  /**
   * Iniciar sesión con username y password (validación y token en servidor)
   */
  async login(username: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const sanitizedUsername = sanitize.text(username, 50).trim();
      const sanitizedPassword = password.trim();

      if (!sanitizedUsername || !sanitizedPassword) {
        return { user: null, error: 'Usuario y contraseña son requeridos' };
      }

      const clientKey = `login_${sanitizedUsername}_${window.location.hostname}`;
      if (!loginRateLimiter.check(clientKey)) {
        const timeRemaining = Math.ceil(loginRateLimiter.getTimeUntilReset(clientKey) / 60000);
        return {
          user: null,
          error: `Demasiados intentos fallidos. Intente nuevamente en ${timeRemaining} minuto(s).`,
        };
      }

      const { data, error } = await supabase.rpc('sie_iniciar_sesion', {
        p_username: sanitizedUsername,
        p_password: sanitizedPassword,
      });

      if (error) {
        console.error('Error en sie_iniciar_sesion:', error.message);
        return { user: null, error: 'No se pudo iniciar sesión. Contacte al administrador.' };
      }

      const result = data as SieLoginResponse | null;
      if (!result?.ok || !result.token || !result.user) {
        return { user: null, error: result?.error || 'Usuario o contraseña incorrectos' };
      }

      loginRateLimiter.reset(clientKey);

      const user: User = {
        id: result.user.id,
        username: result.user.username,
        fullName: result.user.fullName,
        email: result.user.email,
        role: result.user.role,
        active: result.user.active,
        gradosAsignados: result.user.gradosAsignados,
        cambioPasswordObligatorio: result.user.cambioPasswordObligatorio,
      };

      sessionService.saveSession(user, result.token, result.expiresInMs);
      lastRenewAttempt = Date.now();

      return { user, error: null };
    } catch (error: unknown) {
      console.error('Error en login:', error);
      const message = error instanceof Error ? error.message : 'Error al iniciar sesión';
      return { user: null, error: message };
    }
  },

  /**
   * Renueva (desliza) la ventana de inactividad del token en el servidor.
   * Devuelve true si la sesión sigue válida y se extendió.
   */
  async renewSession(): Promise<boolean> {
    const token = sessionService.getApiToken();
    if (!token) return false;

    try {
      const { data, error } = await supabase.rpc('sie_renovar_sesion', { p_token: token });
      if (error) {
        console.warn('Error al renovar sesión:', error.message);
        return false;
      }
      const result = data as SieRenewResponse | null;
      if (!result?.ok) return false;

      sessionService.syncServerExpiry(result.expiresInMs);
      return true;
    } catch (error) {
      console.warn('Error al renovar sesión:', error);
      return false;
    }
  },

  /**
   * Renueva la sesión en el servidor como máximo cada pocos minutos.
   * Pensado para llamarse libremente ante cualquier actividad (incluido cada escaneo)
   * sin saturar la red: mantiene viva la sesión del tutor mientras trabaja.
   */
  renewSessionThrottled(): void {
    const now = Date.now();
    if (now - lastRenewAttempt < RENEW_THROTTLE_MS) return;
    lastRenewAttempt = now;
    void this.renewSession();
  },

  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    const token = sessionService.getApiToken();
    if (token) {
      try {
        await supabase.rpc('sie_cerrar_sesion', { p_token: token });
      } catch (error) {
        console.warn('Error al cerrar sesión en servidor:', error);
      }
    }
    lastRenewAttempt = 0;
    resetSupabaseWarmup();
    sessionService.clearSession();
  },

  /**
   * Obtener usuario actual desde sesión
   */
  getCurrentUser(): User | null {
    const session = sessionService.getSession();
    if (!session) return null;

    if (sessionService.isExpired()) {
      void this.logout();
      return null;
    }

    return session.user;
  },

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  },

  /**
   * Solicitar recuperación de contraseña
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('sie_solicitar_reset_password', {
        p_email: email.trim(),
      });

      if (error) {
        console.error('Error en sie_solicitar_reset_password:', error);
        return { success: false, error: 'Error al solicitar recuperación' };
      }

      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.error) {
        return { success: false, error: result.error };
      }

      return { success: true, error: null };
    } catch (error: unknown) {
      console.error('Error en requestPasswordReset:', error);
      const message = error instanceof Error ? error.message : 'Error al solicitar recuperación';
      return { success: false, error: message };
    }
  },

  async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  async changePassword(
    _userId: number,
    newPassword: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const apiToken = sessionService.getApiToken();
      if (!apiToken) {
        return { success: false, error: 'Sesión expirada. Vuelva a iniciar sesión.' };
      }

      const { data, error } = await supabase.rpc('sie_cambiar_password', {
        p_token: apiToken,
        p_new_password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        return { success: false, error: result?.error || 'Error al cambiar contraseña' };
      }

      return { success: true, error: null };
    } catch (error: unknown) {
      console.error('Error en changePassword:', error);
      const message = error instanceof Error ? error.message : 'Error al cambiar contraseña';
      return { success: false, error: message };
    }
  },
};
