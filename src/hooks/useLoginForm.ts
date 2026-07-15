import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';
import { authService } from '@/lib/services';
import { getHomeRouteForRole } from '@/lib/utils/roleRoutes';
import { ensureSupabaseReady } from '@/lib/supabaseWarmup';
import { useErrorDialog } from '@/hooks/useErrorDialog';

const STAFF_ROLES = new Set(['Supervisor', 'Director', 'Admin']);

export function useLoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { errorDialog, showAuthError, closeError } = useErrorDialog();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('expired') !== 'true') return;
    const role = searchParams.get('role');
    const message =
      role === 'tutor'
        ? 'Sesión del tutor cerrada por inactividad (15 min).'
        : role === 'padre'
          ? 'Sesión del portal familiar cerrada por inactividad (15 min).'
          : 'Su sesión se cerró por inactividad. Vuelva a iniciar sesión.';
    toast.info(message);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('Ingrese usuario y contraseña');
      return;
    }

    if (!isMountedRef.current) return;
    setLoading(true);

    try {
      const { user, error } = await authService.login(username, password);

      if (!isMountedRef.current) return;

      if (error) {
        showAuthError(error || 'Credenciales inválidas');
        setLoading(false);
        return;
      }

      if (user) {
        staffNotify.success('¡Bienvenido!', `Hola, ${user.fullName}`);
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        if (user.cambioPasswordObligatorio) {
          navigate('/cambiar-password', { replace: true });
          return;
        }
        if (STAFF_ROLES.has(user.role)) {
          await ensureSupabaseReady();
        }
        navigate(getHomeRouteForRole(user.role));
      }
    } catch {
      if (!isMountedRef.current) return;
      showAuthError('Error al iniciar sesión');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    loading,
    errorDialog,
    closeError,
    handleLogin,
  };
}
