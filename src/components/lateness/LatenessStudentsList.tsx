import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { normalizeSearchText } from '@/lib/utils/latenessStats';
import type { LatenessClassroom, LatenessStudent } from '@/lib/utils/latenessStats';

interface LatenessStudentsListProps {
  students: LatenessStudent[];
  selectedClassroom: LatenessClassroom | null;
  onClearClassroom: () => void;
  /** En «Hoy» cada alumno tiene una sola llegada: se muestra la hora en vez del conteo. */
  singleDay?: boolean;
  pageSize?: number;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function formatDelay(minutes: number | null): string {
  if (minutes == null) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function LatenessStudentsList({
  students,
  selectedClassroom,
  onClearClassroom,
  singleDay = false,
  pageSize = 10,
}: LatenessStudentsListProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeSearchText(query);
    return students.filter(
      (s) =>
        (!selectedClassroom || s.classroomKey === selectedClassroom.key) &&
        (!q || normalizeSearchText(s.studentName).includes(q)),
    );
  }, [students, selectedClassroom, query]);

  const maxCount = Math.max(1, ...filtered.map((s) => s.lateCount));
  const visible = expanded ? filtered : filtered.slice(0, pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar alumno…"
            className="h-9 pl-8"
            aria-label="Buscar alumno con tardanza"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {selectedClassroom && (
            <button
              type="button"
              onClick={onClearClassroom}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 font-medium text-foreground hover:bg-muted"
            >
              Aula {selectedClassroom.label}
              <X className="h-3 w-3" aria-label="Quitar filtro de aula" />
            </button>
          )}
          <span className="tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'alumno' : 'alumnos'}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          {query ? 'Ningún alumno coincide con la búsqueda' : 'Nadie llegó tarde en este período'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Alumno</th>
                <th className="px-3 py-2 text-left font-medium">Aula</th>
                <th className="px-3 py-2 text-left font-medium">{singleDay ? 'Llegó' : 'Tardanzas'}</th>
                <th className="px-3 py-2 text-right font-medium">{singleDay ? 'Retraso' : 'Retraso prom.'}</th>
                {!singleDay && <th className="px-3 py-2 text-right font-medium">Última</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((s) => (
                <tr key={s.studentId} className="transition-colors hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: 'hsl(var(--late-1))', color: 'hsl(var(--late-text-1))' }}
                        aria-hidden
                      >
                        {initials(s.studentName)}
                      </span>
                      <span className="truncate font-medium text-foreground">{s.studentName}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{s.classroomLabel}</td>
                  <td className="px-3 py-2">
                    {singleDay ? (
                      <span className="font-semibold tabular-nums text-foreground">{s.lastTime || '—'}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(s.lateCount / maxCount) * 100}%`, backgroundColor: 'hsl(var(--late-4))' }}
                          />
                        </div>
                        <span className="font-semibold tabular-nums text-foreground">{s.lateCount}</span>
                        {s.justifiedCount > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            ({s.justifiedCount} justif.)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatDelay(s.avgMinutesLate)}
                  </td>
                  {!singleDay && (
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {format(parseISO(s.lastDate), 'dd MMM', { locale: es })}
                      {s.lastTime && <span className="ml-1 text-foreground">{s.lastTime}</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Ver menos' : `Ver los ${filtered.length}`}
          </Button>
        </div>
      )}
    </div>
  );
}
