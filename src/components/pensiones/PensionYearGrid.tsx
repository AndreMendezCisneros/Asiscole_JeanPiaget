import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PensionEstado, PensionRow } from '@/types';
import { pensionesService } from '@/lib/services';

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function toneForEstado(estado: PensionEstado | null): string {
  if (estado === 'pagado') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (estado === 'pendiente') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (estado === 'moroso') return 'bg-red-100 text-red-900 border-red-200';
  return 'bg-muted text-muted-foreground border-border';
}

function labelForEstado(estado: PensionEstado | null): string {
  if (estado === 'pagado') return 'Pagado';
  if (estado === 'pendiente') return 'Pendiente';
  if (estado === 'moroso') return 'Moroso';
  return 'Sin dato';
}

type Props = {
  idEstudiante: number;
  anio?: number;
  className?: string;
};

export function PensionYearGrid({ idEstudiante, anio: anioProp, className }: Props) {
  const anio = anioProp ?? new Date().getFullYear();
  const [rows, setRows] = useState<PensionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void pensionesService.historialAnio(idEstudiante, anio).then(({ rows: data, error: err }) => {
      if (cancelled) return;
      setRows(data);
      setError(err);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [idEstudiante, anio]);

  const byMonth = useMemo(() => {
    const map = new Map<number, PensionRow>();
    for (const row of rows) {
      const month = Number(row.periodo.split('-')[1]);
      if (month >= 1 && month <= 12) map.set(month, row);
    }
    return map;
  }, [rows]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando pensiones…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-foreground">Pensiones {anio}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MONTH_LABELS.map((label, idx) => {
          const month = idx + 1;
          const row = byMonth.get(month) ?? null;
          const estado = row?.estado ?? null;
          return (
            <div
              key={label}
              className={cn(
                'rounded-md border px-2 py-2 text-center text-xs',
                toneForEstado(estado),
              )}
              title={row ? `${row.periodo}: ${labelForEstado(estado)} (pagado=${row.pagado})` : undefined}
            >
              <div className="font-semibold">{label}</div>
              <div className="mt-0.5 opacity-90">{labelForEstado(estado)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
