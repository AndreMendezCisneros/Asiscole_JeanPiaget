import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { heatStep, type LatenessClassroom, type LatenessGradeRow } from '@/lib/utils/latenessStats';

interface LatenessHeatmapProps {
  grades: LatenessGradeRow[];
  sections: string[];
  max: number;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** Versión resumida: celdas bajas, sin % ni barra de totales. */
  dense?: boolean;
}

function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

function Cell({
  classroom,
  max,
  selected,
  onSelect,
  dense,
}: {
  classroom: LatenessClassroom;
  max: number;
  selected: boolean;
  onSelect: () => void;
  dense?: boolean;
}) {
  const step = heatStep(classroom.lateCount, max);
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          data-selected={selected}
          aria-pressed={selected}
          aria-label={`${classroom.label}: ${classroom.lateCount} tardanzas, ${classroom.studentsLate} alumnos`}
          className={cn(
            'late-cell flex w-full min-w-[3.25rem] flex-col items-center justify-center rounded-lg',
            dense ? 'h-10' : 'h-14 sm:h-16',
          )}
          style={{
            backgroundColor: `hsl(var(--late-${step}))`,
            color: `hsl(var(--late-text-${step}))`,
          }}
        >
          <span className="text-base font-bold leading-none tabular-nums sm:text-lg">
            {classroom.lateCount}
          </span>
          {!dense && classroom.enrolled > 0 && classroom.lateCount > 0 && (
            <span className="mt-1 text-[10px] font-medium leading-none tabular-nums opacity-85">
              {pct(classroom.studentRate)}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-56 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">{classroom.label}</p>
          <p className="text-[11px] text-muted-foreground">{classroom.level}</p>
        </div>
        <dl className="space-y-1 px-3 py-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Tardanzas</dt>
            <dd className="font-semibold tabular-nums">{classroom.lateCount}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Alumnos con tardanza</dt>
            <dd className="font-semibold tabular-nums">
              {classroom.studentsLate}
              {classroom.enrolled > 0 && (
                <span className="font-normal text-muted-foreground"> de {classroom.enrolled}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">% del aula</dt>
            <dd className="font-semibold tabular-nums">{pct(classroom.studentRate)}</dd>
          </div>
        </dl>
        <p className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
          {selected ? 'Clic para quitar el filtro' : 'Clic para ver los alumnos del aula'}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Mapa de calor grado × sección: cada celda es un aula; el tono indica cuántas tardanzas tuvo. */
export function LatenessHeatmap({ grades, sections, max, selectedKey, onSelect, dense = false }: LatenessHeatmapProps) {
  const maxGradeTotal = Math.max(1, ...grades.map((g) => g.lateCount));

  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <table className="w-full border-separate" style={{ borderSpacing: dense ? '4px' : '6px' }}>
          <caption className="sr-only">Tardanzas por grado y sección</caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Grado
              </th>
              {sections.map((s) => (
                <th
                  key={s}
                  scope="col"
                  className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {s}
                </th>
              ))}
              <th
                scope="col"
                className={cn(
                  'pl-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground',
                  !dense && 'sm:w-28',
                )}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.key}>
                <th scope="row" className="whitespace-nowrap pr-1 text-left text-sm font-semibold text-foreground">
                  {g.label}
                </th>
                {sections.map((s) => {
                  const c = g.cells[s];
                  return (
                    <td key={s} className="p-0">
                      {c ? (
                        <Cell
                          classroom={c}
                          max={max}
                          selected={selectedKey === c.key}
                          onSelect={() => onSelect(selectedKey === c.key ? null : c.key)}
                          dense={dense}
                        />
                      ) : (
                        <div
                          className={cn(
                            'w-full min-w-[3.25rem] rounded-lg border border-dashed border-border/70',
                            dense ? 'h-10' : 'h-14 sm:h-16',
                          )}
                          aria-label="Sin aula"
                        />
                      )}
                    </td>
                  );
                })}
                <td className="pl-2">
                  <div className="flex items-center gap-2">
                    <div className={cn('hidden h-1.5 flex-1 overflow-hidden rounded-full bg-muted', !dense && 'sm:block')}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(g.lateCount / maxGradeTotal) * 100}%`,
                          backgroundColor: 'hsl(var(--late-4))',
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums text-foreground">
                      {g.lateCount}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Menos</span>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className={cn('h-3 w-5 rounded-[3px]', step === 0 && 'ring-1 ring-inset ring-border')}
                style={{ backgroundColor: `hsl(var(--late-${step}))` }}
              />
            ))}
          </div>
          <span>Más tardanzas</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-[3px] border border-dashed border-border" aria-hidden />
            Sin aula
          </span>
          {!dense && <span>El % es la parte del aula que llegó tarde al menos una vez</span>}
        </div>
      </div>
    </div>
  );
}
