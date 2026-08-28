import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { studentsService } from '@/lib/services';
import { cn } from '@/lib/utils';
import { CLASSROOM_FIELD_LABELS } from '@/lib/constants/classrooms';
import {
  sortStudentsForSearch,
  studentMatchesSearchTokens,
  tokenizeSearchQuery,
} from '@/lib/utils/studentSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Student } from '@/types';
import { toast } from 'sonner';

type Props = {
  value?: number | null;
  onChange: (studentId: number, student: Student) => void;
  onClear?: () => void;
  disabled?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  variant?: 'combobox' | 'search';
  id?: string;
};

function studentOptionLabel(student: Student): string {
  return `${student.fullName} — ${student.level} · ${CLASSROOM_FIELD_LABELS.grade} ${student.grade} · ${CLASSROOM_FIELD_LABELS.section} ${student.section}`;
}

export function StudentSearchCombobox({
  value,
  onChange,
  onClear,
  disabled,
  allowClear = false,
  placeholder,
  variant = 'combobox',
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const [results, setResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenizeSearchQuery(debounced), [debounced]);
  const searchPlaceholder = placeholder ?? 'Nombre completo del estudiante...';

  useEffect(() => {
    if (value == null) {
      setSelected(null);
    }
  }, [value]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void studentsService.searchForTutorScanner(debounced, 30).then(({ students, error }) => {
      if (cancelled) return;
      if (error) toast.error(error);
      const narrowed = sortStudentsForSearch(
        students.filter((student) => studentMatchesSearchTokens(student, tokens)),
        tokens,
      );
      setResults(narrowed);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [debounced, tokens]);

  useEffect(() => {
    if (variant !== 'search') return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [variant]);

  const pickStudent = (student: Student) => {
    setSelected(student);
    setQuery(student.fullName);
    onChange(student.id, student);
    setOpen(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    onClear?.();
  };

  const selectedLabel =
    selected && selected.id === value
      ? `${selected.fullName} · ${selected.level} ${selected.grade} ${selected.section}`
      : value
        ? `Estudiante #${value}`
        : 'Buscar y seleccionar estudiante';

  const waitingForSearch =
    query.trim().length >= 2 && (loading || query.trim() !== debounced.trim());
  const showSearchList = open && !selected && query.trim().length >= 2;

  if (variant === 'search') {
    return (
      <div ref={rootRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          disabled={disabled}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="pl-10 pr-10"
          onFocus={() => {
            if (query.trim().length >= 2 && !selected) setOpen(true);
          }}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (selected) {
              setSelected(null);
              onClear?.();
            }
          }}
        />
        {allowClear && (selected || query) ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
            aria-label="Quitar estudiante"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        {showSearchList ? (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            {waitingForSearch ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando coincidencias…
              </div>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Sin coincidencias
              </p>
            ) : (
              <ul className="max-h-64 overflow-auto py-1">
                {results.map((student) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => pickStudent(student)}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          value === student.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{student.fullName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {student.level} · {CLASSROOM_FIELD_LABELS.grade} {student.grade} ·{' '}
                          {CLASSROOM_FIELD_LABELS.section} {student.section}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-10 w-full justify-between font-normal"
        >
          <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
            {selectedLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder ?? 'Escriba el nombre (mín. 2 letras)…'}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {waitingForSearch ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando…
              </div>
            ) : query.trim().length < 2 ? (
              <CommandEmpty>Escriba al menos 2 letras para buscar</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>Sin coincidencias</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((student) => (
                  <CommandItem
                    key={student.id}
                    value={String(student.id)}
                    onSelect={() => pickStudent(student)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === student.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{studentOptionLabel(student)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
