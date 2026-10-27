import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tutoriasService } from '@/lib/services/tutoriasService';
import type { Personal } from '@/types/personal';
import { formatSalon, salonKey, type SalonDisponible, type Tutoria } from '@/types/tutorAula';

interface TutorAulaDialogProps {
  personal: Personal | null;
  /** Todas las tutorías (para marcar salones ocupados). */
  tutorias: Tutoria[];
  salones: SalonDisponible[];
  /** Nombre del empleado por id_personal (para "ocupado por …"). */
  personalNames: Map<number, string>;
  onClose: () => void;
  onSaved: () => void;
}

/** RR.HH.: asigna al empleado como docente tutor de un salón con usuario y contraseña. */
export function TutorAulaDialog({ personal, tutorias, salones, personalNames, onClose, onSaved }: TutorAulaDialogProps) {
  const current = useMemo(
    () => (personal ? tutorias.find((t) => t.personalId === personal.id) ?? null : null),
    [personal, tutorias],
  );

  const [salon, setSalon] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!personal) return;
    setSalon(current ? salonKey(current) : '');
    setUsername(current?.username ?? personal.barcode);
    setPassword('');
    setShowPassword(false);
    setActive(current?.active ?? true);
    setConfirmRemove(false);
  }, [personal, current]);

  const occupiedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tutorias) {
      if (!t.active || t.personalId === personal?.id) continue;
      map.set(salonKey(t), personalNames.get(t.personalId) ?? t.username);
    }
    return map;
  }, [tutorias, personal, personalNames]);

  const selected = salones.find((s) => salonKey(s) === salon) ?? null;

  const save = async () => {
    if (!personal) return;
    if (!selected) {
      toast.error('Elija el salón');
      return;
    }
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username.trim())) {
      toast.error('Usuario inválido: 3 a 50 caracteres (letras, números, punto, guion)');
      return;
    }
    if (!current && password.trim().length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (current && password.trim() && password.trim().length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSaving(true);
    const { error } = await tutoriasService.save({
      personalId: personal.id,
      username,
      password,
      level: selected.level,
      grade: selected.grade,
      section: selected.section,
      active,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(current ? 'Tutor actualizado' : `Tutor creado: ${username.trim()}`);
    onSaved();
  };

  const remove = async () => {
    if (!personal) return;
    setSaving(true);
    const { error } = await tutoriasService.remove(personal.id);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Tutoría eliminada');
    onSaved();
  };

  return (
    <Dialog open={personal !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tutor de aula</DialogTitle>
          <DialogDescription>
            {personal?.fullName}. Con este usuario solo podrá ver la llegada, salida, incidencias y asistencia de
            su salón; no puede modificar nada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Salón</Label>
            <Select value={salon} onValueChange={setSalon}>
              <SelectTrigger aria-label="Salón">
                <SelectValue placeholder="Elija el salón" />
              </SelectTrigger>
              <SelectContent>
                {salones.map((s) => {
                  const key = salonKey(s);
                  const busy = occupiedBy.get(key);
                  return (
                    <SelectItem key={key} value={key} disabled={Boolean(busy)}>
                      {formatSalon(s)} · {s.students} alumnos{busy ? ` · tutor: ${busy}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutor-username">Usuario</Label>
            <Input
              id="tutor-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tutor-password">{current ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Label>
            <div className="relative">
              <Input
                id="tutor-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={current ? 'Dejar vacío para no cambiarla' : 'Mínimo 6 caracteres'}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="tutor-active">Acceso activo</Label>
              <p className="text-xs text-muted-foreground">Si lo desactiva, se cierra su sesión.</p>
            </div>
            <Switch id="tutor-active" checked={active} onCheckedChange={setActive} />
          </div>

          {current?.lastAccess && (
            <p className="text-xs text-muted-foreground">
              Último ingreso: {new Date(current.lastAccess).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {current ? (
            confirmRemove ? (
              <Button variant="destructive" onClick={() => void remove()} disabled={saving}>
                Confirmar: quitar tutor
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRemove(true)} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Quitar tutor
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="info" onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
