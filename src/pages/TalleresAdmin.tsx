import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { BookOpen, CalendarDays, Clock3, Edit, Loader2, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffToolbar,
} from '@/components/staff';
import { talleresService } from '@/lib/services';
import type { Taller } from '@/types';

const WEEK_DAYS = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 7, label: 'Domingo', short: 'Dom' },
] as const;

const tallerFormSchema = z
  .object({
    nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120, 'Máximo 120 caracteres'),
    descripcion: z.string().max(300, 'Máximo 300 caracteres').optional(),
    diaSemana: z.array(z.number().int().min(1).max(7)).default([]),
    horaInicio: z.string().optional(),
    horaFin: z.string().optional(),
    activo: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.horaInicio && data.horaFin && data.horaFin <= data.horaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['horaFin'],
        message: 'La hora de fin debe ser posterior a la hora de inicio',
      });
    }
  });

type TallerFormValues = z.infer<typeof tallerFormSchema>;

const tallerFormDefaults: TallerFormValues = {
  nombre: '',
  descripcion: '',
  diaSemana: [],
  horaInicio: '',
  horaFin: '',
  activo: true,
};

function formatSchedule(taller: Taller): string {
  if (!taller.horaInicio && !taller.horaFin) return 'Sin horario';
  if (taller.horaInicio && taller.horaFin) return `${taller.horaInicio} - ${taller.horaFin}`;
  return taller.horaInicio ? `Desde ${taller.horaInicio}` : `Hasta ${taller.horaFin}`;
}

function formatDays(days: number[] | null): string {
  if (!days?.length) return 'Sin días';
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => WEEK_DAYS.find((item) => item.value === day)?.label ?? `Día ${day}`)
    .join(', ');
}

export const TalleresAdmin = () => {
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaller, setEditingTaller] = useState<Taller | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isMountedRef = useRef(true);

  const form = useForm<TallerFormValues>({
    resolver: zodResolver(tallerFormSchema),
    defaultValues: tallerFormDefaults,
  });

  const loadTalleres = async (silent?: boolean) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const { talleres: talleresList, error } = await talleresService.listAll();

      if (!isMountedRef.current) return;

      if (error) {
        toast.error(error);
        setTalleres([]);
        return;
      }

      setTalleres(talleresList);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error al cargar talleres:', error);
      toast.error('No se pudieron cargar los talleres');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    void loadTalleres();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const filteredTalleres = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) return talleres;

    return talleres.filter((taller) => {
      return (
        taller.nombre.toLowerCase().includes(normalizedQuery) ||
        (taller.descripcion ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [searchTerm, talleres]);

  const stats = useMemo(() => {
    const activos = talleres.filter((taller) => taller.activo).length;
    return {
      total: talleres.length,
      activos,
      inactivos: talleres.length - activos,
    };
  }, [talleres]);

  const openCreateDialog = () => {
    setEditingTaller(null);
    form.reset(tallerFormDefaults);
    setDialogOpen(true);
  };

  const openEditDialog = (taller: Taller) => {
    setEditingTaller(taller);
    form.reset({
      nombre: taller.nombre,
      descripcion: taller.descripcion ?? '',
      diaSemana: taller.diaSemana ?? [],
      horaInicio: taller.horaInicio ?? '',
      horaFin: taller.horaFin ?? '',
      activo: taller.activo,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TallerFormValues) => {
    setSubmitting(true);

    const payload = {
      nombre: values.nombre.trim(),
      descripcion: values.descripcion?.trim() || null,
      diaSemana: values.diaSemana.length > 0 ? values.diaSemana : null,
      horaInicio: values.horaInicio?.trim() || null,
      horaFin: values.horaFin?.trim() || null,
    };

    try {
      if (editingTaller) {
        const { taller, error } = await talleresService.update(editingTaller.id, payload);
        if (error || !taller) {
          toast.error(error || 'No se pudo actualizar el taller');
          return;
        }

        if (editingTaller.activo !== values.activo) {
          const stateChange = await talleresService.setActivo(editingTaller.id, values.activo);
          if (stateChange.error || !stateChange.success) {
            toast.error(stateChange.error || 'No se pudo actualizar el estado del taller');
            return;
          }
        }

        toast.success('Taller actualizado');
        setDialogOpen(false);
        setEditingTaller(null);
        form.reset(tallerFormDefaults);
        await loadTalleres(true);
        return;
      }

      const { taller, error } = await talleresService.create(payload);
      if (error || !taller) {
        toast.error(error || 'No se pudo crear el taller');
        return;
      }

      if (!values.activo) {
        const stateChange = await talleresService.setActivo(taller.id, false);
        if (stateChange.error || !stateChange.success) {
          toast.error(stateChange.error || 'No se pudo ajustar el estado inicial del taller');
          return;
        }
      }

      toast.success('Taller creado');
      setDialogOpen(false);
      form.reset(tallerFormDefaults);
      await loadTalleres(true);
    } catch (error) {
      console.error('Error al guardar taller:', error);
      toast.error('Ocurrió un error al guardar el taller');
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  if (loading && talleres.length === 0) {
    return <PageLoader message="Cargando talleres..." />;
  }

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={BookOpen}
        eyebrow="Talleres"
        title="Administración de Talleres"
        description="Cree o active un taller. En el escáner solo se registra la hora de llegada (sin inscritos ni faltas)."
        accent="success"
      >
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingTaller(null);
              form.reset(tallerFormDefaults);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <BookOpen className="mr-2 h-4 w-4" />
              Nuevo taller
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTaller ? 'Editar taller' : 'Crear taller'}</DialogTitle>
              <DialogDescription>
                Basta con el nombre. Horario y días son opcionales (sirven de referencia).
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Talleres, Extracurricular..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notas internas (opcional)"
                          className="min-h-[80px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="diaSemana"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Días (opcional)</FormLabel>
                      <div className="grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4">
                        {WEEK_DAYS.map((day) => {
                          const checked = field.value.includes(day.value);
                          return (
                            <label key={day.value} className="flex items-center gap-2 text-sm font-medium">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                  const nextValue = nextChecked
                                    ? [...field.value, day.value]
                                    : field.value.filter((value) => value !== day.value);
                                  field.onChange([...nextValue].sort((a, b) => a - b));
                                }}
                              />
                              <span>{day.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="horaInicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora inicio (opcional)</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="horaFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora fin (opcional)</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="activo"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Taller activo</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Si está activo, el escáner lo usa automáticamente para registrar llegadas.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="success" disabled={submitting}>
                    {submitting ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </span>
                    ) : editingTaller ? (
                      'Guardar cambios'
                    ) : (
                      'Crear taller'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-3">
        <StaffKpiStat label="Total talleres" value={stats.total} icon={BookOpen} tone="primary" />
        <StaffKpiStat label="Activos" value={stats.activos} icon={CalendarDays} tone="success" />
        <StaffKpiStat label="Inactivos" value={stats.inactivos} icon={Clock3} tone="warning" />
      </div>

      <StaffToolbar
        title="Buscar"
        description="El escáner usa el primer taller activo; no hace falta elegir alumnos ni el taller a mano."
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="talleres-search">Buscar taller</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="talleres-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nombre del taller..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void loadTalleres(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Talleres (${filteredTalleres.length})`}
          description="Solo catálogo. No se administran inscritos: cualquier alumno puede registrar llegada en el escáner."
          accent="neutral"
        />
        <StaffDataPanelBody className="space-y-4">
          {filteredTalleres.length === 0 ? (
            <StaffEmptyState
              icon={BookOpen}
              title="No hay talleres"
              description="Cree un taller activo (p. ej. «Talleres») para usar el modo Talleres del escáner."
            />
          ) : (
            <div className="app-table-wrap">
              <Table aria-label="Lista de talleres">
                <TableHeader>
                  <TableRow>
                    <TableHead>Taller</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTalleres.map((taller) => (
                    <TableRow key={taller.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{taller.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {taller.descripcion?.trim() || 'Sin descripción'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDays(taller.diaSemana)}
                      </TableCell>
                      <TableCell>{formatSchedule(taller)}</TableCell>
                      <TableCell>
                        <Badge variant={taller.activo ? 'default' : 'secondary'}>
                          {taller.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(taller)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </StaffDataPanelBody>
      </StaffDataPanel>
    </div>
  );
};

export default TalleresAdmin;
