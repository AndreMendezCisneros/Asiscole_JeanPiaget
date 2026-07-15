/**
 * Página de cambio obligatorio de contraseña.
 * OWASP A07:2025 — Authentication Failures
 *
 * El usuario es redirigido aquí cuando cambioPasswordObligatorio = true.
 * No puede acceder a ninguna otra ruta hasta completar el cambio.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/services';
import { sanitize } from '@/lib/utils/sanitize';
import { getHomeRouteForRole } from '@/lib/utils/roleRoutes';
import { toast } from 'sonner';

export const ChangePassword = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    // Si no hay sesión, redirigir al login
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    // Si no es obligatorio el cambio, redirigir al inicio
    if (!user.cambioPasswordObligatorio) {
      navigate(getHomeRouteForRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const { valid, error: pwError } = sanitize.password(newPassword);
    if (!valid) {
      setValidationError(pwError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Las contraseñas no coinciden.');
      return;
    }

    if (!user) return;

    setSaving(true);
    try {
      const { success, error } = await authService.changePassword(user.id, newPassword);
      if (!success) {
        setValidationError(error ?? 'Error al cambiar la contraseña.');
        return;
      }
      toast.success('Contraseña actualizada correctamente');
      // Cerrar sesión y volver al login para que el usuario vuelva a autenticarse
      await authService.logout();
      navigate('/login', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 ring-2 ring-amber-500/40">
            <ShieldCheck className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Cambio de contraseña requerido</h1>
          <p className="mt-2 text-sm text-white/60">
            Por seguridad, debes establecer una nueva contraseña antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="new-password">
          {/* Nueva contraseña */}
          <div className="space-y-2">
            <Label htmlFor="new-pw" className="text-white/80 text-sm font-medium">
              Nueva contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                id="new-pw"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-2">
            <Label htmlFor="confirm-pw" className="text-white/80 text-sm font-medium">
              Confirmar contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                id="confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
                className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-white/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Requisitos */}
          <ul className="rounded-xl bg-white/5 p-3 text-xs text-white/50 space-y-1">
            <li className={newPassword.length >= 8 ? 'text-green-400' : ''}>✓ Mínimo 8 caracteres</li>
            <li className={/[A-Z]/.test(newPassword) ? 'text-green-400' : ''}>✓ Al menos una mayúscula</li>
            <li className={/[a-z]/.test(newPassword) ? 'text-green-400' : ''}>✓ Al menos una minúscula</li>
            <li className={/[0-9]/.test(newPassword) ? 'text-green-400' : ''}>✓ Al menos un número</li>
          </ul>

          {validationError && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {validationError}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving || !newPassword || !confirmPassword}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
          >
            {saving ? 'Guardando…' : 'Cambiar contraseña'}
          </Button>
        </form>
      </div>
    </div>
  );
};
