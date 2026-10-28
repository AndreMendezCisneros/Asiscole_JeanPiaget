import type { ReactNode } from 'react';

/** Caja de tooltip común a los gráficos de Reportes. */
export function ChartTooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-[9rem] rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </p>
  );
}

/** Cifra corta en la cabecera de un gráfico. */
export function ChartStat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold leading-tight tabular-nums text-foreground">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Frase de lectura rápida bajo un gráfico. */
export function ChartInsight({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-primary/10 bg-primary/[0.04] px-3 py-2 text-xs leading-relaxed text-muted-foreground">{children}</p>
  );
}
