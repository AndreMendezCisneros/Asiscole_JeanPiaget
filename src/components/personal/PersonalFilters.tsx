import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PERSONAL_CATEGORIAS } from '@/types/personal';
import type { CategoryFilter } from '@/lib/utils/personalFilter';

interface SearchFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export const PersonalSearchField = ({ id, value, onChange }: SearchFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor={id}>Buscar</Label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nombre o DNI..."
        className="pl-10"
      />
    </div>
  </div>
);

interface CategorySelectProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

export const PersonalCategorySelect = ({ value, onChange }: CategorySelectProps) => (
  <div className="space-y-2">
    <Label>Categoría</Label>
    <Select value={value} onValueChange={(v) => onChange(v as CategoryFilter)}>
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
);

interface EmployeeOption {
  id: number;
  fullName: string;
  category: string;
}

interface EmployeeFilterProps {
  employees: EmployeeOption[];
  /** null = todos */
  value: number | null;
  onChange: (value: number | null) => void;
}

function foldName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Filtro "Empleado": elegir una persona de la lista (con buscador). */
export const PersonalEmployeeFilter = ({ employees, value, onChange }: EmployeeFilterProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sorted = useMemo(
    () => [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );
  const terms = foldName(query.trim()).split(/\s+/).filter(Boolean);
  const visible = sorted.filter((e) => terms.every((t) => foldName(e.fullName).includes(t)));
  const selected = sorted.find((e) => e.id === value) ?? null;

  return (
    <div className="space-y-2">
      <Label>Empleado</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? selected.fullName : 'Todos los empleados'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Escriba el nombre…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>Sin coincidencias</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__todos__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                  Todos los empleados
                </CommandItem>
                {visible.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={String(e.id)}
                    onSelect={() => {
                      onChange(e.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === e.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1 truncate">{e.fullName}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{e.category}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
