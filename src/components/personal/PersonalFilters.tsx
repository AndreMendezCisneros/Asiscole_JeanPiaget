import { Search } from 'lucide-react';
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
