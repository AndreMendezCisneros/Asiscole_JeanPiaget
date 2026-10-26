import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Briefcase,
  CalendarClock,
  Edit,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffTablePagination,
  StaffToolbar,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { ScheduleEditor } from '@/components/personal/ScheduleEditor';
import { PersonalImportDialog } from '@/components/personal/PersonalImportDialog';
import { studentsService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { formatScheduleSummary, validateSchedule } from '@/lib/utils/personalSchedule';
import { useTablePagination } from '@/hooks/useTablePagination';
import { TABLE_PAGE_SIZE } from '@/lib/constants/tablePagination';
import {
  PERSONAL_CATEGORIAS,
  type Personal,
  type PersonalCategoria,
  type PersonalFormData,
} from '@/types/personal';

const EMPTY_FORM: PersonalFormData = {
  barcode: '',
  fullName: '',
  category: 'Docente Primaria',
  position: '',
  birthDate: '',
  address: '',
  phone: '',
  email: '',
  profilePhoto: null,
  active: true,
  schedule: [],
};

function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function toForm(p: Personal): PersonalFormData {
  return {
    barcode: p.barcode,
    fullName: p.fullName,
    category: p.category,
    position: p.position ?? '',
    birthDate: p.birthDate ?? '',
    address: p.address ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    profilePhoto: p.profilePhoto,
    active: p.active,
    schedule: p.schedule,
  };
}

function validateForm(form: PersonalFormData): string | null {
  if (!/^\d{8}$/.test(form.barcode.trim())) return 'El DNI debe tener 8 dígitos.';
  if (form.fullName.trim().length < 3) return 'Ingrese el nombre completo.';
  if (form.email && form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Email inválido.';
  return validateSchedule(form.schedule);
}

export const PersonalList = () => {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PersonalCategoria>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Personal | null>(null);
  const [form, setForm] = useState<PersonalFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    const { personal: rows, error } = await personalService.getAll();
    if (error) toast.error(error);
    else setPersonal(rows);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const terms = foldText(search.trim()).split(/\s+/).filter(Boolean);
    return personal.filter((p) => {
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (terms.length === 0) return true;
      const haystack = foldText(`${p.fullName} ${p.barcode} ${p.position ?? ''}`);
      return terms.every((t) => haystack.includes(t));
    });
  }, [personal, search, categoryFilter, statusFilter]);

  const { page, pageSize, totalPages, goToPage, nextPage, prevPage, changePageSize, resetPage } =
    useTablePagination({ totalItems: filtered.length, initialPageSize: TABLE_PAGE_SIZE });

  useEffect(() => {
    resetPage();
  }, [search, categoryFilter, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const active = personal.filter((p) => p.active);
    return {
      active: active.length,
      inactive: personal.length - active.length,
      withoutSchedule: active.filter((p) => p.schedule.length === 0).length,
      categories: new Set(active.map((p) => p.category)).size,
    };
  }, [personal]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (p: Personal) => {
    setEditing(p);
    setForm(toForm(p));
    setFormOpen(true);
  };

  const patch = (changes: Partial<PersonalFormData>) => setForm((f) => ({ ...f, ...changes }));

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    const { url, error } = await studentsService.uploadProfilePhoto(file);
    setUploadingPhoto(false);
    if (error || !url) {
      toast.error(error ?? 'No se pudo subir la foto');
      return;
    }
    patch({ profilePhoto: url });
  };

  const handleSave = async () => {
    const data = { ...form, barcode: form.barcode.trim() };
    const error = validateForm(data);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { barcode: _barcode, ...changes } = data;
        const result = await personalService.update(editing.id, changes);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Empleado actualizado');
      } else {
        const collisions = await personalService.findStudentBarcodeCollisions([data.barcode]);
        if (collisions.length > 0) {
          toast.error('Ese DNI ya está registrado como estudiante.');
          return;
        }
        const result = await personalService.create(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success('Empleado agregado');
      }
      setFormOpen(false);
      void load(true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Personal) => {
    const { error } = await personalService.update(p.id, { active: !p.active });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(p.active ? 'Empleado desactivado' : 'Empleado activado');
    void load(true);
  };

  if (loading) return <PageLoader message="Cargando personal..." />;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Briefcase}
        eyebrow="Personal"
        title="Gestión de Personal"
        description="Datos de cada empleado y su horario de entrada y salida por día"
        accent="info"
      >
        <div className="flex gap-2">
          <Button variant="outline-primary" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <Button variant="info" onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo empleado
          </Button>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat label="Activos" value={stats.active} hint="Empleados en planilla" icon={UserCheck} tone="info" />
        <StaffKpiStat
          label="Sin horario"
          value={stats.withoutSchedule}
          hint="No se les controla asistencia"
          icon={CalendarClock}
          tone={stats.withoutSchedule > 0 ? 'warning' : 'success'}
        />
        <StaffKpiStat label="Categorías" value={stats.categories} hint="Grupos con personal activo" icon={Briefcase} tone="primary" />
        <StaffKpiStat label="Inactivos" value={stats.inactive} hint="Ya no se escanean" icon={UserX} tone="secondary" />
      </div>

      <StaffToolbar title="Buscar y filtrar" description="Por nombre, DNI, cargo o categoría">
        <div className="col-span-full space-y-2">
          <Label htmlFor="personal-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="personal-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, DNI o cargo..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as 'all' | PersonalCategoria)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {PERSONAL_CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => void load(true)} className="w-full" disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Personal (${filtered.length})`}
          description={
            filtered.length > pageSize
              ? `Página ${page} de ${totalPages} · ${pageSize} por página`
              : 'Haga clic en editar para cambiar datos u horario'
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {filtered.length === 0 ? (
            <StaffEmptyState
              icon={Briefcase}
              title={personal.length === 0 ? 'Aún no hay personal registrado' : 'Sin resultados'}
              description={
                personal.length === 0
                  ? 'Use "Importar Excel" para cargar el directorio del personal'
                  : 'Pruebe otro término o cambie los filtros'
              }
            />
          ) : (
            <>
              <div className="app-table-wrap">
                <Table aria-label="Lista de personal">
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">Nombre</TableHead>
                      <TableHead scope="col">DNI</TableHead>
                      <TableHead scope="col">Categoría / Cargo</TableHead>
                      <TableHead scope="col">Horario</TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <StudentPhoto src={p.profilePhoto} name={p.fullName} className="h-9 w-9 shrink-0" />
                            <span className="font-medium">{p.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{p.barcode}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{p.category}</span>
                            {p.position && <span className="text-muted-foreground">{p.position}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.schedule.length === 0 ? (
                            <Badge variant="outline" className="border-warning text-warning">
                              Sin horario
                            </Badge>
                          ) : (
                            formatScheduleSummary(p.schedule)
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Activo' : 'Inactivo'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(p)}
                              aria-label={`Editar ${p.fullName}`}
                              title="Editar datos y horario"
                            >
                              <Edit className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleActive(p)}
                              aria-label={p.active ? `Desactivar ${p.fullName}` : `Activar ${p.fullName}`}
                              title={p.active ? 'Desactivar' : 'Activar'}
                            >
                              {p.active ? (
                                <UserX className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <UserCheck className="h-4 w-4" aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > pageSize && (
                <StaffTablePagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filtered.length}
                  onPrev={prevPage}
                  onNext={nextPage}
                  onGoToPage={goToPage}
                  onPageSizeChange={changePageSize}
                />
              )}
            </>
          )}
        </div>
      </StaffDataPanel>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
            <DialogDescription>
              El DNI es el código de barras de su carnet. El horario define cuándo llega a tiempo o tarde.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2">
              <StudentPhoto src={form.profilePhoto} name={form.fullName} className="h-14 w-14" />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handlePhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Foto
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-dni">DNI</Label>
              <Input
                id="p-dni"
                inputMode="numeric"
                maxLength={8}
                value={form.barcode}
                disabled={Boolean(editing)}
                onChange={(e) => patch({ barcode: e.target.value.replace(/\D/g, '') })}
                placeholder="8 dígitos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Apellidos y nombres</Label>
              <Input id="p-name" value={form.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => patch({ category: v as PersonalCategoria })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAL_CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-position">Cargo</Label>
              <Input
                id="p-position"
                value={form.position ?? ''}
                onChange={(e) => patch({ position: e.target.value })}
                placeholder="Ej. Docente de Matemática"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-birth">Fecha de nacimiento</Label>
              <Input
                id="p-birth"
                type="date"
                value={form.birthDate ?? ''}
                onChange={(e) => patch({ birthDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-phone">Teléfono</Label>
              <Input id="p-phone" inputMode="tel" value={form.phone ?? ''} onChange={(e) => patch({ phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-email">Email</Label>
              <Input id="p-email" type="email" value={form.email ?? ''} onChange={(e) => patch({ email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-address">Dirección</Label>
              <Input id="p-address" value={form.address ?? ''} onChange={(e) => patch({ address: e.target.value })} />
            </div>
            {editing && (
              <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2">
                <Switch checked={form.active ?? true} onCheckedChange={(checked) => patch({ active: checked })} />
                Activo (si está inactivo no se escanea ni se le marcan faltas)
              </label>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label>Horario semanal</Label>
              <ScheduleEditor value={form.schedule} onChange={(schedule) => patch({ schedule })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="info" onClick={() => void handleSave()} disabled={saving || uploadingPhoto}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersonalImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load(true)} />
    </div>
  );
};

export default PersonalList;
