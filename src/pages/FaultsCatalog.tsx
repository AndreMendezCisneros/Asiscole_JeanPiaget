import { useEffect, useMemo, useState } from 'react';
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
import { Search, Plus, Edit, Loader2, BookOpen, FolderPlus } from 'lucide-react';
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
import { DEFAULT_FAULT_CATEGORIES } from '@/lib/constants/faultCategories';

const faultFormSchema = z.object({
  nombre_falta: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  descripcion: z.string()
    .max(500, 'Máximo 500 caracteres')
    .optional(),
  categoria: z.string().min(1, 'La categoría es requerida').max(50, 'Máximo 50 caracteres'),
  es_grave: z.boolean(),
  puntos_reincidencia: z.number()
    .min(1, 'Los puntos deben ser al menos 1')
    .max(100, 'Máximo 100 puntos'),
});

type FaultFormValues = z.infer<typeof faultFormSchema>;

const faultFormDefaults: FaultFormValues = {
  nombre_falta: '',
  descripcion: '',
  categoria: DEFAULT_FAULT_CATEGORIES[0],
  es_grave: false,
  puntos_reincidencia: 1,
};

export const FaultsCatalog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<FaultCategory | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingFault, setEditingFault] = useState<FaultType | null>(null);
  const [categoryList, setCategoryList] = useState<string[]>([...DEFAULT_FAULT_CATEGORIES]);
  const { data: faults = [], isLoading, refetch } = useFaultsQuery(false);
  const invalidateFaults = useInvalidateFaults();
  const [submitting, setSubmitting] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [tempCategoria, setTempCategoria] = useState<FaultCategory | undefined>(undefined);

  const form = useForm<FaultFormValues>({
    resolver: zodResolver(faultFormSchema),
    defaultValues: faultFormDefaults,
  });

  useEffect(() => {
    void (async () => {
      const { categories } = await faultsService.getCategories(faults);
      setCategoryList(categories);
    })();
  }, [faults]);

  const filterCategories = useMemo(
    (): Array<{ value: FaultCategory | 'all'; label: string }> => [
      { value: 'all', label: 'Todas' },
      ...categoryList.map((c) => ({ value: c, label: c })),
    ],
    [categoryList],
  );

  const filteredFaults = faults.filter(fault => {
    const matchesSearch = fault.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         fault.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || fault.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const resetFormForCreate = () => {
    setEditingFault(null);
    form.reset(faultFormDefaults);
    setTempCategoria(DEFAULT_FAULT_CATEGORIES[0]);
  };

  const openEditDialog = (fault: FaultType) => {
    setEditingFault(fault);
    form.reset({
      nombre_falta: fault.name,
      descripcion: fault.description ?? '',
      categoria: fault.category,
      es_grave: fault.severity === 'Grave',
      puntos_reincidencia: fault.points,
    });
    setTempCategoria(fault.category);
    setDialogOpen(true);
  };

  const onSubmit = async (data: FaultFormValues) => {
    const isEdit = editingFault !== null;
    setSubmitting(true);

    if (isEdit && editingFault) {
      const { success, error } = await faultsService.update(editingFault.id, {
        nombre_falta: data.nombre_falta,
        categoria: data.categoria,
        es_grave: data.es_grave,
        puntos_reincidencia: data.puntos_reincidencia,
        descripcion: data.descripcion || undefined,
      });

      if (error || !success) {
        toast.error(error ?? 'No se pudo actualizar la falta');
      } else {
        toast.success('Falta actualizada exitosamente');
        setDialogOpen(false);
        resetFormForCreate();
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
      });

      if (error) {
        toast.error(error);
      } else {
        toast.success('Falta agregada exitosamente');
        setDialogOpen(false);
        resetFormForCreate();
        invalidateFaults();
        void refetch();
      }
    }

    setSubmitting(false);
  };

  const handleAddCategory = async () => {
    setAddingCategory(true);
    const { categories, error } = await faultsService.addCategory(newCategoryName, faults);
    setAddingCategory(false);

    if (error) {
      toast.error(error);
      return;
    }

    setCategoryList(categories);
    setNewCategoryName('');
    setCategoryDialogOpen(false);
    toast.success('Categoría agregada');
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
  const isEditing = editingFault !== null;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={BookOpen}
        eyebrow="Catálogos"
        title="Catálogo de Faltas"
        description="Defina tipos de falta, severidad y puntos asignados para el cálculo de reincidencia"
        accent="secondary"
      >
        <div className="flex flex-wrap gap-2">
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="w-4 h-4 mr-2" />
                Nueva Categoría
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Agregar categoría</DialogTitle>
                <DialogDescription>
                  Cree una categoría nueva para organizar las faltas del catálogo.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="new-category">Nombre de la categoría</Label>
                <Input
                  id="new-category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej. Tecnología"
                  maxLength={50}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="success"
                  disabled={addingCategory || newCategoryName.trim().length < 2}
                  onClick={() => void handleAddCategory()}
                >
                  {addingCategory ? (
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </span>
                  ) : (
                    'Guardar categoría'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) {
                if (!editingFault) {
                  resetFormForCreate();
                }
              } else {
                resetFormForCreate();
                setTempCategoria(undefined);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="warning" onClick={() => resetFormForCreate()}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Falta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Falta' : 'Agregar Nueva Falta'}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? 'Modifique los datos de la falta seleccionada.'
                    : 'Complete la información de la nueva falta. Todos los campos son obligatorios.'}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="categoria"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría</FormLabel>
                          <Select
                            value={tempCategoria ?? field.value}
                            onValueChange={(value) => {
                              setTempCategoria(value);
                              field.onChange(value);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categoryList.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
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
                      ) : isEditing ? (
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
        </div>
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
            options={filterCategories}
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
                  onClick={() => openEditDialog(fault)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-3">
                {fault.description || 'Sin descripción'}
              </p>
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
