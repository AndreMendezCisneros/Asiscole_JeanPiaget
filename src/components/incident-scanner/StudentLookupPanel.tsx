import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Barcode, Loader2, Search } from 'lucide-react';
import type { Student } from '@/types';
import { cn } from '@/lib/utils';

interface StudentLookupPanelProps {
  barcode: string;
  onBarcodeChange: (value: string) => void;
  onBarcodeSubmit: (e: React.FormEvent) => void;
  onBarcodeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  nameSearch: string;
  onNameSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNameSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  nameSearchResults: Student[];
  onSelectStudent: (student: Student) => void;
  lookupBusy: boolean;
  nameSearching: boolean;
  nameSearchError: string | null;
  nameSearchEmpty: boolean;
  barcodeInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function StudentLookupPanel({
  barcode,
  onBarcodeChange,
  onBarcodeSubmit,
  onBarcodeKeyDown,
  nameSearch,
  onNameSearchChange,
  onNameSearchKeyDown,
  nameSearchResults,
  onSelectStudent,
  lookupBusy,
  nameSearching,
  nameSearchError,
  nameSearchEmpty,
  barcodeInputRef,
}: StudentLookupPanelProps) {
  return (
    <CardContent className="p-5 sm:p-7 pt-5 sm:pt-6">
      <form
        onSubmit={onBarcodeSubmit}
        className="space-y-5"
        aria-busy={lookupBusy}
        aria-label="Buscar estudiante por código o nombre"
      >
        <div className="space-y-2">
          <Label htmlFor="barcode-input" className="text-sm font-medium text-foreground">
            Código de barras / DNI
          </Label>
          <div className="relative">
            <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={barcodeInputRef}
              id="barcode-input"
              value={barcode}
              onChange={onBarcodeChange}
              onKeyDown={onBarcodeKeyDown}
              placeholder="Escanee o escriba el código"
              className="tutor-field-input pl-10 font-mono text-base"
              autoComplete="off"
              inputMode="numeric"
            />
            {lookupBusy && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name-search" className="text-sm font-medium text-foreground">
            Búsqueda por nombre
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name-search"
              value={nameSearch}
              onChange={onNameSearchChange}
              onKeyDown={onNameSearchKeyDown}
              placeholder="Apellidos o nombre del estudiante"
              className="tutor-field-input pl-10"
              autoComplete="off"
            />
            {nameSearching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {nameSearchError && <p className="text-sm text-destructive">{nameSearchError}</p>}
          {nameSearchEmpty && !nameSearchError && (
            <p className="text-sm text-muted-foreground">No se encontraron estudiantes en sus salones.</p>
          )}
        </div>

        {nameSearchResults.length > 0 && (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1">
            {nameSearchResults.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm',
                    'hover:bg-muted/80 transition-colors',
                  )}
                  onClick={() => onSelectStudent(student)}
                >
                  <span className="font-medium truncate">{student.fullName}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {student.level} {student.grade}-{student.section}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </CardContent>
  );
}
