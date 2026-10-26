import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScheduleEditor } from './ScheduleEditor';
import { PersonalCategorySelect } from './PersonalFilters';
import type { CategoryFilter } from '@/lib/utils/personalFilter';
import { personalService } from '@/lib/services/personalService';
import { formatScheduleSummary, validateSchedule } from '@/lib/utils/personalSchedule';
import type { DiaSemana, HorarioDia, Personal } from '@/types/personal';

interface BulkScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personal: Personal[];
  onApplied: () => void;
}

const DEFAULT: HorarioDia[] = ([1, 2, 3, 4, 5] as DiaSemana[]).map((day) => ({ day, entry: '07:30', exit: '15:00' }));

/** Aplica el mismo horario semanal a varios empleados (por categoría o selección). */
export const BulkScheduleDialog = ({ open, onOpenChange, personal, onApplied }: BulkScheduleDialogProps) => {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [schedule, setSchedule] = useState<HorarioDia[]>(DEFAULT);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);

  const candidates = useMemo(
    () => personal.filter((p) => p.active && (category === 'all' || p.category === category)),
    [personal, category],
  );

  useEffect(() => {
    setSelected(new Set(candidates.map((p) => p.id)));
  }, [candidates]);

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = async () => {
    const error = validateSchedule(schedule);
    if (error) {
      toast.error(error);
      return;
    }
    const ids = candidates.filter((p) => selected.has(p.id)).map((p) => p.id);
    setApplying(true);
    setProgress(0);
    const failed: string[] = [];
    for (const [i, id] of ids.entries()) {
      const res = await personalService.update(id, { schedule });
      if (res.error) failed.push(res.error);
      setProgress(i + 1);
    }
    setApplying(false);
    if (failed.length) toast.error(`${failed.length} no se actualizaron: ${failed[0]}`);
    toast.success(`Horario aplicado a ${ids.length - failed.length} empleados`);
    onApplied();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !applying && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aplicar horario a varios</DialogTitle>
          <DialogDescription>
            Reemplaza el horario semanal de los empleados marcados. Las llegadas ya registradas no cambian.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <PersonalCategorySelect value={category} onChange={setCategory} />
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(candidates.map((p) => p.id)))}>
              Marcar todos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Ninguno
            </Button>
          </div>
        </div>

        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
          {candidates.map((p) => (
            <label key={p.id} className="flex items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
              <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, Boolean(v))} />
              <span className="min-w-0 flex-1 truncate">{p.fullName}</span>
              <span className="text-xs text-muted-foreground">{formatScheduleSummary(p.schedule)}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Nuevo horario</Label>
          <ScheduleEditor value={schedule} onChange={setSchedule} disabled={applying} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancelar
          </Button>
          <Button variant="info" onClick={() => void apply()} disabled={applying || selected.size === 0}>
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
            {applying ? `Aplicando ${progress}/${selected.size}` : `Aplicar a ${selected.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
