import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { DIAS_SEMANA, type DiaSemana, type HorarioDia } from '@/types/personal';

interface ScheduleEditorProps {
  value: HorarioDia[];
  onChange: (next: HorarioDia[]) => void;
  disabled?: boolean;
}

const DEFAULT_ENTRY = '07:30';
const DEFAULT_EXIT = '15:00';

/**
 * Horario semanal del empleado: se marca cada día que asiste con su hora de
 * entrada y (opcional) de salida. Día sin marcar = no le toca asistir.
 */
export const ScheduleEditor = ({ value, onChange, disabled }: ScheduleEditorProps) => {
  const byDay = new Map(value.map((h) => [h.day, h]));

  const setDay = (day: DiaSemana, patch: Partial<HorarioDia> | null) => {
    const others = value.filter((h) => h.day !== day);
    if (patch === null) {
      onChange(others);
      return;
    }
    const current = byDay.get(day) ?? { day, entry: DEFAULT_ENTRY, exit: DEFAULT_EXIT };
    onChange([...others, { ...current, ...patch, day }].sort((a, b) => a.day - b.day));
  };

  const copyFirstToWeekdays = () => {
    const first = [...value].sort((a, b) => a.day - b.day)[0];
    if (!first) return;
    const weekend = value.filter((h) => h.day >= 6);
    const weekdays = ([1, 2, 3, 4, 5] as DiaSemana[]).map((day) => ({ ...first, day }));
    onChange([...weekdays, ...weekend]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Marque los días que asiste con su hora de entrada y de salida (obligatoria). Tarde = un minuto después de su entrada.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyFirstToWeekdays}
          disabled={disabled || value.length === 0}
          title="Copia el horario del primer día marcado a lunes–viernes"
        >
          <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Igual L–V
        </Button>
      </div>
      <div className="rounded-lg border">
        <div className="grid grid-cols-[minmax(6.5rem,1fr)_1fr_1fr] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>Día</span>
          <span>Entrada</span>
          <span>Salida</span>
        </div>
        {DIAS_SEMANA.map(({ value: day, label }) => {
          const h = byDay.get(day);
          const id = `horario-dia-${day}`;
          return (
            <div
              key={day}
              className="grid grid-cols-[minmax(6.5rem,1fr)_1fr_1fr] items-center gap-2 border-b px-3 py-2 last:border-b-0"
            >
              <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  id={id}
                  checked={Boolean(h)}
                  disabled={disabled}
                  onCheckedChange={(checked) => setDay(day, checked ? {} : null)}
                />
                {label}
              </label>
              <Input
                type="time"
                aria-label={`Hora de entrada ${label}`}
                value={h?.entry ?? ''}
                disabled={disabled || !h}
                onChange={(e) => setDay(day, { entry: e.target.value })}
              />
              <Input
                type="time"
                aria-label={`Hora de salida ${label}`}
                value={h?.exit ?? ''}
                disabled={disabled || !h}
                onChange={(e) => setDay(day, { exit: e.target.value || null })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
