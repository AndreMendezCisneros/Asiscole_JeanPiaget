import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TABLE_PAGE_SIZE_OPTIONS } from '@/lib/constants/tablePagination';

type Props = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  showPageSize?: boolean;
  className?: string;
};

/**
 * Paginación staff uniforme: flechas + ir a página + tamaño (10/25/50).
 */
export function StaffTablePagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPrev,
  onNext,
  onGoToPage,
  onPageSizeChange,
  showPageSize = true,
  className,
}: Props) {
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  const commitPage = () => {
    const n = Number(draftPage);
    if (Number.isFinite(n)) onGoToPage(n);
    else setDraftPage(String(page));
  };

  return (
    <div
      className={`mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className ?? ''}`}
    >
      <p className="text-sm text-muted-foreground">
        {totalItems} resultado{totalItems === 1 ? '' : 's'} · página {page} de {totalPages} ·{' '}
        {pageSize} por página
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {showPageSize && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Filas</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Filas por página">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Ir a</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            className="h-9 w-16 text-center"
            value={draftPage}
            onChange={(e) => setDraftPage(e.target.value)}
            onBlur={commitPage}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitPage();
              }
            }}
            aria-label="Número de página"
          />
          <span className="text-sm text-muted-foreground">/ {totalPages}</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
