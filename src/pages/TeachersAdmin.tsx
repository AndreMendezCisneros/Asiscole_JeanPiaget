import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Pencil, Plus, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClassroomAssignmentPicker } from '@/components/admin/ClassroomAssignmentPicker';
import { teachersService, type TeacherAccount } from '@/lib/services/teachersService';
import type { DocenteClassroom } from '@/types';
import { formatClassroomLabel } from '@/lib/utils/docenteAssignments';

type FormState = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  classrooms: DocenteClassroom[];
  active: boolean;
  resetPassword: boolean;
};

const emptyForm = (): FormState => ({
  username: '',
  password: '',
  fullName: '',
  email: '',
  classrooms: [],
  active: true,
  resetPassword: false,
});

export const TeachersAdmin = () => {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherAccount | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    const { teachers: rows, error } = await teachersService.list();
    if (error) toast.error(error);
    setTeachers(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (teacher: TeacherAccount) => {
    setEditing(teacher);
    setForm({
      username: teacher.username,
      password: '',
      fullName: teacher.fullName,
      email: teacher.email,
      classrooms: [...teacher.classrooms],
      active: teacher.active,
      resetPassword: false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error('Complete nombre y correo');
      return;
    }
    if (form.classrooms.length === 0) {
      toast.error('Asigne al menos un salón');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await teachersService.update({
          id: editing.id,
          fullName: form.fullName,
          email: form.email,
          classrooms: form.classrooms,
          active: form.active,
          password: form.resetPassword ? form.password : undefined,
        });
        if (error) {
          toast.error(error);
          return;
        }
        toast.success('Docente actualizado');
      } else {
        if (form.username.trim().length < 3) {
          toast.error('Usuario inválido');
          return;
        }
        if (form.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          return;
        }
        const { error } = await teachersService.create({
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          email: form.email,
          classrooms: form.classrooms,
        });
        if (error) {
          toast.error(error);
          return;
        }
        toast.success('Docente creado');
      }
      setDialogOpen(false);
      await loadTeachers();
    } finally {
      setSaving(false);
    }
  };

  const pauseTeacher = async (teacher: TeacherAccount) => {
    const { error } = await teachersService.update({
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      classrooms: teacher.classrooms,
      active: false,
    });
    if (error) toast.error(error);
    else {
      toast.success('Docente pausado');
      await loadTeachers();
    }
  };

  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={GraduationCap}
        eyebrow="Administración"
        title="Docentes"
        description="Crear cuentas docente, asignar salones y gestionar acceso"
        accent="secondary"
      >
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo docente
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando docentes…
          </div>
        ) : teachers.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">No hay docentes registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Salones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{teacher.fullName}</p>
                      <p className="text-xs text-muted-foreground">{teacher.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{teacher.username}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-md">
                      {teacher.classrooms.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin salones</span>
                      ) : (
                        teacher.classrooms.map((c) => (
                          <Badge key={`${teacher.id}-${c.level}-${c.grade}-${c.section}`} variant="outline" className="text-[10px]">
                            {formatClassroomLabel(c)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={teacher.active ? 'default' : 'secondary'}>
                      {teacher.active ? 'Activo' : 'Pausado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {teacher.lastAccess
                      ? format(new Date(teacher.lastAccess), "d MMM yyyy, HH:mm", { locale: es })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(teacher)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {teacher.active && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void pauseTeacher(teacher)}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar docente' : 'Nuevo docente'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Actualice datos, salones o contraseña temporal.'
                : 'El docente deberá cambiar la contraseña en el primer inicio de sesión.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña temporal</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Salones asignados</Label>
              <ClassroomAssignmentPicker
                value={form.classrooms}
                onChange={(classrooms) => setForm((f) => ({ ...f, classrooms }))}
                disabled={saving}
              />
            </div>

            {editing && (
              <>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Cuenta activa</p>
                    <p className="text-xs text-muted-foreground">Desactivar impide el inicio de sesión</p>
                  </div>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(active) => setForm((f) => ({ ...f, active }))}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Restablecer contraseña</Label>
                    <Switch
                      checked={form.resetPassword}
                      onCheckedChange={(resetPassword) => setForm((f) => ({ ...f, resetPassword }))}
                    />
                  </div>
                  {form.resetPassword && (
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Nueva contraseña"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear docente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
