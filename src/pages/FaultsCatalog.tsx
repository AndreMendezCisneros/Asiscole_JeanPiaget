import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Loader2, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffSegmentedControl,
  StaffEmptyState,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { FaultCategory } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { faultsService } from '@/lib/services';
import { FaultType } from '@/types';
import { useFaultsQuery, useInvalidateFaults } from '@/hooks/queries/useFaultsQuery';

const faultFormSchema = z.object({
  nombre_falta: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  descripcion: z.string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
  recomendacion: z.string()
    .max(800, 'Máximo 800 caracteres')
    .optional(),
  categoria: z.enum(['Conducta', 'Uniforme', 'Académica', 'Puntualidad'] as const, {
    required_error: 'La categoría es requerida',
  }),
  es_grave: z.boolean(),
  puntos_reincidencia: z.number()
    .min(1, 'Los puntos deben ser al menos 1')
    .max(100, 'Máximo 100 puntos'),
});

type FaultFormValues = z.infer<typeof faultFormSchema>;

const faultFormDefaults: FaultFormValues = {
  nombre_falta: '',
  descripcion: '',
  recomendacion: '',
  categoria: 'Conducta',
  es_grave: false,
  puntos_reincidencia: 1,
};

export const FaultsCatalog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaultCategory | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFault, setEditingFault] = useState<FaultType | null>(null);
  const { data: faults = [], isLoading, refetch } = useFaultsQuery(false);
  const invalidateFaults = useInvalidateFaults();
  const [submitting, setSubmitting] = useState(false);
  // Estado temporal para Select dentro del Dialog
  const [tempCategoria, setTempCategoria] = useState<FaultCategory | undefined>(undefined);

  const form = useForm<FaultFormValues>({
    resolver: zodResolver(faultFormSchema),
    defaultValues: faultFormDefaults,
  });

  const filteredFaults = faults.filter(fault => {
    const matchesSearch = fault.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.recommendation?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || fault.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: Array<{ value: FaultCategory | 'all', label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'Conducta', label: 'Conducta' },
    { value: 'Uniforme', label: 'Uniforme' },
    { value: 'Académica', label: 'Académica' },
    { value: 'Puntualidad', label: 'Puntualidad' },
  ];

  const openCreateDialog = () => {
    setEditingFault(null);
    form.reset(faultFormDefaults);
    setTempCategoria('Conducta');
    setDialogOpen(true);
  };

  const openEditDialog = (fault: FaultType) => {
    const categoria = (
      ['Conducta', 'Uniforme', 'Académica', 'Puntualidad'].includes(fault.category)
        ? fault.category
        : 'Conducta'
    ) as FaultCategory;
    setEditingFault(fault);
    form.reset({
      nombre_falta: fault.name,
      descripcion: fault.description || '',
      recomendacion: fault.recommendation || '',
      categoria,
      es_grave: fault.severity === 'Grave',
      puntos_reincidencia: fault.points,
    });
    setTempCategoria(categoria);
    setDialogOpen(true);
  };

  const onSubmit = async (data: FaultFormValues) => {
    setSubmitting(true);
    if (editingFault) {
      const { success, error } = await faultsService.update(editingFault.id, {
        nombre_falta: data.nombre_falta,
        categoria: data.categoria,
        es_grave: data.es_grave,
        puntos_reincidencia: data.puntos_reincidencia,
        descripcion: data.descripcion || null,
        recomendacion: data.recomendacion?.trim() || null,
      });
      if (error || !success) {
        toast.error(error || 'No se pudo actualizar la falta');
      } else {
        toast.success('Falta actualizada');
        setDialogOpen(false);
        setEditingFault(null);
        form.reset(faultFormDefaults);
        setTempCategoria(undefined);
        invalidateFaults();
        void refetch();
      }
    } else {
      const { error } = await faultsService.create({
        nombre_falta: data.nombre_falta,
        categoria: data.categoria,
        es_grave: data.es_grave,
        puntos_reincidencia: data.puntos_reincidencia,
        descripcion: data.descripcion || null,
        recomendacion: data.recomendacion?.trim() || null,
      });

      if (error) {
        toast.error(error);
      } else {
        toast.success('Falta agregada exitosamente');
        setDialogOpen(false);
        form.reset(faultFormDefaults);
        setTempCategoria('Conducta');
        invalidateFaults();
        void refetch();
      }
    }
    setSubmitting(false);
  };

  if (isLoading && faults.length === 0) {
    return (
      <div className="app-page">
        <div className="app-page-state">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const graveCount = faults.filter((f) => f.severity === 'Grave').length;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={BookOpen}
        eyebrow="Catálogos"
        title="Catálogo de Faltas"
        description="Defina tipos de falta, severidad y puntos asignados para el cálculo de reincidencia"
        accent="secondary"
      >
        <Dialog 
          open={dialogOpen} 
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingFault(null);
              form.reset(faultFormDefaults);
              setTempCategoria(undefined);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="warning" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Falta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingFault ? 'Editar Falta' : 'Agregar Nueva Falta'}</DialogTitle>
              <DialogDescription>
                {editingFault
                  ? 'Actualice la información y la recomendación que se enviará por WhatsApp.'
                  : 'Complete la información de la nueva falta. Incluya una recomendación para el apoderado.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre_falta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Falta</FormLabel>
                      <FormControl>
                        <Input placeholder="Uso inadecuado del uniforme" {...field} />
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
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción detallada de la falta y su contexto..."
                          className="min-h-[100px]"
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
                  name="recomendacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recomendación para apoderado (WhatsApp)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ej.: Conversar en casa sobre el respeto a las normas del aula y acompañar al estudiante en la reflexión..."
                          className="min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select 
                          value={tempCategoria || undefined}
                          onValueChange={(value) => {
                            const categoriaValue = value as FaultCategory;
                            setTempCategoria(categoriaValue);
                            field.onChange(categoriaValue);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Conducta">Conducta</SelectItem>
                            <SelectItem value="Uniforme">Uniforme</SelectItem>
                            <SelectItem value="Académica">Académica</SelectItem>
                            <SelectItem value="Puntualidad">Puntualidad</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="puntos_reincidencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puntos</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="es_grave"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Falta Grave</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Marque si esta falta es considerada grave
                        </div>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4"
                        />
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
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </span>
                    ) : editingFault ? (
                      'Guardar cambios'
                    ) : (
                      'Guardar Falta'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat label="Total faltas" value={faults.length} icon={BookOpen} tone="primary" />
        <StaffKpiStat
          label="En vista"
          value={filteredFaults.length}
          hint={activeCategory === 'all' ? 'Todas las categorías' : activeCategory}
          icon={Search}
          tone="info"
        />
        <StaffKpiStat
          label="Graves"
          value={graveCount}
          hint="Requieren atención prioritaria"
          icon={Plus}
          tone="warning"
        />
      </div>

      <StaffToolbar title="Buscar y categorizar">
        <div className="space-y-2 sm:col-span-2">
          <Label className="app-toolbar-label">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre o descripción..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="app-toolbar-label">Categoría</Label>
          <StaffSegmentedControl
            value={activeCategory}
            onValueChange={(v) => setActiveCategory(v as FaultCategory | 'all')}
            options={categories}
            listClassName="sm:grid-cols-5"
            aria-label="Filtrar por categoría"
          />
        </div>
      </StaffToolbar>

      {filteredFaults.length === 0 ? (
        <StaffEmptyState
          icon={BookOpen}
          title="Sin faltas en esta vista"
          description="Cambie la categoría o el término de búsqueda"
        />
      ) : (
        <div className="app-fault-grid">
          {filteredFaults.map((fault) => (
            <article key={fault.id} className="app-fault-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-2">
                  <h3 className="text-base font-semibold leading-tight">{fault.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity={fault.severity} />
                    <Badge variant="outline">{fault.category}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="Editar falta"
                  type="button"
                  onClick={() => openEditDialog(fault)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-3">
                {fault.description || 'Sin descripción'}
              </p>
              {fault.recommendation ? (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                  <span className="font-medium text-foreground">Recomendación: </span>
                  {fault.recommendation}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <Badge variant={fault.active ? 'default' : 'secondary'}>
                  {fault.active ? 'Activa' : 'Inactiva'}
                </Badge>
                <span className="font-semibold tabular-nums">{fault.points} pts</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};