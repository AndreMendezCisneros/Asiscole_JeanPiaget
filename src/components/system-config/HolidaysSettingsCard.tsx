import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffDataPanelBody,
} from '@/components/staff';
import {
  holidaysService,
  type CalendarioNoLectivo,
  type CalendarioNoLectivoTipo,
} from '@/lib/services/holidaysService';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { buildMonthGrid, WEEKDAY_LABELS } from '@/lib/utils/parentAttendanceCalendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE_SIZE = 8;

type ViewMode = 'calendario' | 'lista';

export function HolidaysSettingsCard() {
  const todayKey = getLimaTodayDate();
  const currentYear = Number(todayKey.slice(0, 4));
  const currentMonth = Number(todayKey.slice(5, 7));

  const [year, setYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewMode, setViewMode] = useState<ViewMode>('calendario');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CalendarioNoLectivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<CalendarioNoLectivoTipo>('colegio');
  const [busy, setBusy] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { items: rows, error: err } = await holidaysService.listByYear(year);
    if (err) {
      setError(err);
      setItems([]);
    } else {
      setItems(rows);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [year, viewMode]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarioNoLectivo>();
    for (const item of items) map.set(item.fecha, item);
    return map;
  }, [items]);

  const activos = useMemo(() => items.filter((i) => i.activo).length, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, pageSafe]);

  const monthCells = useMemo(() => buildMonthGrid(year, viewMonth), [year, viewMonth]);
  const monthTitle = format(new Date(year, viewMonth - 1, 1), 'MMMM yyyy', { locale: es });
  const selectedItem = selectedDay ? byDate.get(selectedDay) : undefined;

  const shiftMonth = (delta: number) => {
    const d = new Date(year, viewMonth - 1 + delta, 1);
    setYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
    setSelectedDay(null);
  };

  const handleDayClick = (dayKey: string) => {
    setSelectedDay(dayKey);
    setFecha(dayKey);
    const existing = byDate.get(dayKey);
    if (existing) {
      setNombre(existing.nombre);
      setTipo(existing.tipo);
    } else if (!nombre.trim()) {
      setNombre('');
      setTipo('colegio');
    }
  };

  const handleAdd = async () => {
    if (!fecha || !nombre.trim()) {
      toast.error('Indique fecha y nombre');
      return;
    }
    setBusy(true);
    const { error: err } = await holidaysService.create({ fecha, nombre, tipo });
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success('Día sin clases agregado');
    setNombre('');
    setTipo('colegio');
    void load();
  };

  const handleSeed = async () => {
    setBusy(true);
    const { inserted, error: err } = await holidaysService.seedNacionales2026();
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(
      inserted > 0
        ? `Se cargaron ${inserted} feriados nacionales 2026`
        : 'Los feriados nacionales 2026 ya estaban cargados'
    );
    setYear(2026);
    void load();
  };

  const handleToggle = async (item: CalendarioNoLectivo) => {
    setBusy(true);
    const { error: err } = await holidaysService.setActivo(item.id, !item.activo);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(item.activo ? 'Día desactivado' : 'Día activado');
    void load();
  };

  const handleDelete = async (item: CalendarioNoLectivo) => {
    if (!window.confirm(`¿Eliminar «${item.nombre}» (${item.fecha})?`)) return;
    setBusy(true);
    const { error: err } = await holidaysService.remove(item.id);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success('Eliminado');
    if (selectedDay === item.fecha) setSelectedDay(null);
    void load();
  };

  return (
    <StaffDataPanel>
      <StaffDataPanelHeader
        accent="secondary"
        title="Días sin clases / Feriados"
        description="Feriados nacionales y días del colegio. En estas fechas no se marca falta automática al cierre."
      />
      <StaffDataPanelBody className="space-y-6">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">No se pudo cargar el calendario</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-1"
                role="tablist"
                aria-label="Vista de feriados"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'calendario' ? 'default' : 'ghost'}
                  className="h-8"
                  role="tab"
                  aria-selected={viewMode === 'calendario'}
                  onClick={() => setViewMode('calendario')}
                >
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Calendario
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === 'lista' ? 'default' : 'ghost'}
                  className="h-8"
                  role="tab"
                  aria-selected={viewMode === 'lista'}
                  onClick={() => setViewMode('lista')}
                >
                  <List className="mr-1.5 h-3.5 w-3.5" />
                  Lista
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="feriados-year" className="sr-only">
                  Año
                </Label>
                <Input
                  id="feriados-year"
                  type="number"
                  className="w-24 h-8"
                  value={year}
                  onChange={(e) => {
                    setYear(Number(e.target.value) || currentYear);
                    setSelectedDay(null);
                  }}
                />
              </div>

              <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Actualizar
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleSeed()} disabled={busy}>
                <CalendarOff className="mr-1.5 h-3.5 w-3.5" />
                Feriados 2026
              </Button>
              <p className="text-sm text-muted-foreground">
                {activos} activos · {items.length} en {year}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] items-end rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="feriado-fecha">Fecha</Label>
                <Input
                  id="feriado-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setSelectedDay(e.target.value || null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feriado-nombre">Nombre</Label>
                <Input
                  id="feriado-nombre"
                  placeholder="Ej. Jornada pedagógica"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feriado-tipo">Tipo</Label>
                <select
                  id="feriado-tipo"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as CalendarioNoLectivoTipo)}
                >
                  <option value="colegio">Colegio</option>
                  <option value="nacional">Nacional</option>
                </select>
              </div>
              <Button type="button" onClick={() => void handleAdd()} disabled={busy || Boolean(selectedItem)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : viewMode === 'calendario' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold capitalize">{monthTitle}</h3>
                  <Button type="button" size="icon" variant="outline" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60">
                  <div className="grid grid-cols-7 bg-muted/40 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {WEEKDAY_LABELS.map((label) => (
                      <div key={label} className="px-1 py-2">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthCells.map((dayKey, idx) => {
                      if (!dayKey) {
                        return <div key={`empty-${idx}`} className="min-h-[4.5rem] border-t border-border/40 bg-muted/10" />;
                      }
                      const item = byDate.get(dayKey);
                      const isSelected = selectedDay === dayKey;
                      const isToday = dayKey === todayKey;
                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => handleDayClick(dayKey)}
                          className={cn(
                            'min-h-[4.5rem] border-t border-l border-border/40 p-1.5 text-left transition-colors hover:bg-muted/40',
                            idx % 7 === 0 && 'border-l-0',
                            isSelected && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                            item?.activo && 'bg-secondary/15',
                            item && !item.activo && 'opacity-60',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                              isToday && 'bg-primary text-primary-foreground',
                            )}
                          >
                            {Number(dayKey.slice(8, 10))}
                          </span>
                          {item && (
                            <span
                              className={cn(
                                'mt-1 block line-clamp-2 text-[10px] leading-snug',
                                item.activo ? 'text-foreground' : 'line-through text-muted-foreground',
                              )}
                              title={item.nombre}
                            >
                              {item.nombre}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDay && (
                  <div className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm">
                    <p className="font-medium capitalize">
                      {format(parseISO(selectedDay), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    {selectedItem ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={selectedItem.activo ? '' : 'line-through text-muted-foreground'}>
                          {selectedItem.nombre}
                        </span>
                        <Badge variant={selectedItem.tipo === 'nacional' ? 'secondary' : 'outline'}>
                          {selectedItem.tipo === 'nacional' ? 'Nacional' : 'Colegio'}
                        </Badge>
                        {!selectedItem.activo && <Badge variant="destructive">Inactivo</Badge>}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handleToggle(selectedItem)}
                        >
                          {selectedItem.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={busy}
                          onClick={() => void handleDelete(selectedItem)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        Día hábil. Complete el nombre arriba y pulse Agregar para marcarlo sin clases.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay días registrados para {year}. Use el botón de feriados nacionales o agregue uno.
              </p>
            ) : (
              <div className="space-y-3">
                <ul className="divide-y divide-border rounded-xl border border-border/60 overflow-hidden">
                  {pageItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 bg-background"
                    >
                      <span className="font-mono text-sm tabular-nums w-[7.5rem]">{item.fecha}</span>
                      <span
                        className={`flex-1 text-sm ${item.activo ? '' : 'text-muted-foreground line-through'}`}
                      >
                        {item.nombre}
                      </span>
                      <Badge variant={item.tipo === 'nacional' ? 'secondary' : 'outline'}>
                        {item.tipo === 'nacional' ? 'Nacional' : 'Colegio'}
                      </Badge>
                      {!item.activo && <Badge variant="destructive">Inactivo</Badge>}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void handleToggle(item)}
                      >
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(item)}
                        aria-label={`Eliminar ${item.nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    Página {pageSafe} de {totalPages} · {items.length} días
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pageSafe <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pageSafe >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Siguiente
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </StaffDataPanelBody>
    </StaffDataPanel>
  );
}
